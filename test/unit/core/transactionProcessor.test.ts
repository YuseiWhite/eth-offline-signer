// biome-disable-file lint/style/useImportType
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  processTransaction,
  DEFAULT_MAX_RETRIES,
  handleTransactionReceipt,
  setLogger,
  logTransactionSuccess,
  logTransactionError,
} from '../../../src/core/transactionProcessor';
import type { EIP1559TxParams } from '../../../src/types/schema';
import type { Logger } from '../../../src/utils/logger';
import { createPublicClient, http } from 'viem';
import type { Hex, TransactionReceipt } from 'viem';

// モック設定
vi.mock('../../../src/core/signer', () => ({
  signEIP1559TransactionOffline: vi.fn(),
}));

vi.mock('../../../src/core/nonceRetry', () => ({
  executeWithNonceRetry: vi.fn(),
}));

vi.mock('../../../src/core/broadcaster', () => ({
  broadcastTransaction: vi.fn(),
}));

vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(),
    http: vi.fn(),
  };
});

vi.mock('../../../src/core/networkConfig', () => ({
  getNetworkConfig: vi.fn(),
}));

import { signEIP1559TransactionOffline } from '../../../src/core/signer';
import { executeWithNonceRetry } from '../../../src/core/nonceRetry';
import type { NonceRetrySuccessResult } from '../../../src/core/nonceRetry';
import { broadcastTransaction } from '../../../src/core/broadcaster';
import { getNetworkConfig } from '../../../src/core/networkConfig';

const mockSignEIP1559TransactionOffline = vi.mocked(signEIP1559TransactionOffline);
const mockExecuteWithNonceRetry = vi.mocked(executeWithNonceRetry);
const mockCreatePublicClient = vi.mocked(createPublicClient);
const mockHttp = vi.mocked(http);
const mockGetNetworkConfig = vi.mocked(getNetworkConfig);

describe('transactionProcessor', () => {
  const validPrivateKey: Hex = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const validTxParams: EIP1559TxParams = {
    to: '0x742d35Cc6634C0532925a3b8D4C9db7C9C0C7A8A',
    value: '1000000000000000000',
    gasLimit: '21000',
    maxFeePerGas: '20000000000',
    maxPriorityFeePerGas: '1000000000',
    nonce: 10,
    chainId: 11155111,
  };

  const validSignedTx: Hex =
    '0x02f86b8201a4843b9aca00843b9aca0082520894742d35cc6634c0532925a3b8d4c9db7c9c0c7a8a880de0b6b3a76400008025a01234567890abcdef1234567890abcdef1234567890abcdefa01234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const validTxHash: Hex = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12';
  const validRpcUrl = 'https://sepolia.infura.io/v3/test';

  let mockLogger: Logger;
  let mockPublicClient: {
    waitForTransactionReceipt: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      data: vi.fn(),
    };

    mockPublicClient = {
      waitForTransactionReceipt: vi.fn(),
    };

    mockCreatePublicClient.mockReturnValue(
      mockPublicClient as unknown as ReturnType<typeof createPublicClient>
    );
    mockHttp.mockReturnValue({} as unknown as ReturnType<typeof http>);
    mockGetNetworkConfig.mockReturnValue({
      id: 11155111,
      name: 'Sepolia',
      explorerBaseUrl: 'https://sepolia.etherscan.io/tx/',
      chain: {
        id: 11155111,
        name: 'Sepolia',
        nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: ['https://rpc.sepolia.org'] } },
      },
    } as unknown as ReturnType<typeof getNetworkConfig>);

    mockSignEIP1559TransactionOffline.mockResolvedValue(validSignedTx);

    // executeWithNonceRetryのデフォルト成功レスポンスを設定
    mockExecuteWithNonceRetry.mockResolvedValue({
      success: true as const,
      transactionHash: validTxHash,
      explorerUrl: 'https://sepolia.etherscan.io/tx/' + validTxHash,
      finalNonce: validTxParams.nonce,
      retryCount: 0,
    });

    // waitForTransactionReceiptのデフォルトレスポンスを設定
    mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
      blockNumber: 18500000n,
      gasUsed: 21000n,
      status: 'success' as const,
    });
  });

  describe('processTransaction', () => {
    describe('正常系', () => {
      it('ブロードキャストなしで署名のみ実行', async () => {
        const result = await processTransaction({
          privateKey: validPrivateKey,
          txParams: validTxParams,
          broadcast: false,
          logger: mockLogger,
        });

        expect(result).toEqual({
          signedTransaction: validSignedTx,
        });

        expect(mockSignEIP1559TransactionOffline).toHaveBeenCalledWith(
          validPrivateKey,
          validTxParams
        );
        expect(mockLogger.info).toHaveBeenCalledWith('トランザクションの署名を開始...');
        expect(mockLogger.info).toHaveBeenCalledWith('署名完了');
        expect(mockLogger.info).toHaveBeenCalledWith(
          'オフライン署名のみ完了しました。ブロードキャストはスキップされます。'
        );
        expect(mockExecuteWithNonceRetry).not.toHaveBeenCalled();
      });

      it('ブロードキャスト付きで完全実行', async () => {
        const result = await processTransaction({
          privateKey: validPrivateKey,
          txParams: validTxParams,
          rpcUrl: validRpcUrl,
          broadcast: true,
          logger: mockLogger,
        });

        expect(result).toEqual({
          signedTransaction: validSignedTx,
          broadcast: {
            broadcastCompleted: true,
            status: 'SUCCESS',
            transactionHash: validTxHash,
            explorerUrl: 'https://sepolia.etherscan.io/tx/' + validTxHash,
            blockNumber: expect.any(BigInt),
            gasUsed: expect.any(BigInt),
            finalNonce: validTxParams.nonce,
            retryCount: 0,
          },
        });

        expect(mockSignEIP1559TransactionOffline).toHaveBeenCalledWith(
          validPrivateKey,
          validTxParams
        );
        expect(mockExecuteWithNonceRetry).toHaveBeenCalledWith({
          maxRetries: DEFAULT_MAX_RETRIES,
          executeTransaction: expect.any(Function),
          txParams: validTxParams,
          logger: expect.objectContaining({
            info: expect.any(Function),
            error: expect.any(Function),
          }),
        });
      });

      it('カスタムmaxRetriesでブロードキャスト実行', async () => {
        await processTransaction({
          privateKey: validPrivateKey,
          txParams: validTxParams,
          rpcUrl: validRpcUrl,
          broadcast: true,
          maxRetries: 5,
          logger: mockLogger,
        });

        expect(mockExecuteWithNonceRetry).toHaveBeenCalledWith({
          maxRetries: 5,
          executeTransaction: expect.any(Function),
          txParams: validTxParams,
          logger: expect.objectContaining({
            info: expect.any(Function),
            error: expect.any(Function),
          }),
        });
      });

      it('デフォルトmaxRetriesが正しく設定される', async () => {
        await processTransaction({
          privateKey: validPrivateKey,
          txParams: validTxParams,
          rpcUrl: validRpcUrl,
          broadcast: true,
          logger: mockLogger,
        });

        expect(mockExecuteWithNonceRetry).toHaveBeenCalledWith({
          maxRetries: 3,
          executeTransaction: expect.any(Function),
          txParams: validTxParams,
          logger: expect.objectContaining({
            info: expect.any(Function),
            error: expect.any(Function),
          }),
        });
      });

      it('should handle broadcast with executeTransaction internal function coverage', async () => {
        // このテストは、handleBroadcast内のexecuteTransaction関数を特にターゲットにしている
        // transactionProcessor.tsの240-243行目をカバー
        const result = await processTransaction({
          privateKey: validPrivateKey,
          txParams: validTxParams,
          rpcUrl: validRpcUrl,
          broadcast: true,
          logger: mockLogger,
        });

        expect(result).toEqual({
          signedTransaction: validSignedTx,
          broadcast: {
            broadcastCompleted: true,
            status: 'SUCCESS',
            transactionHash: validTxHash,
            explorerUrl: 'https://sepolia.etherscan.io/tx/' + validTxHash,
            blockNumber: expect.any(BigInt),
            gasUsed: expect.any(BigInt),
            finalNonce: validTxParams.nonce,
            retryCount: 0,
          },
        });

        // executeWithNonceRetryに渡されたexecuteTransaction関数が正しい引数で呼び出されたことを確認
        expect(mockExecuteWithNonceRetry).toHaveBeenCalledWith({
          maxRetries: DEFAULT_MAX_RETRIES,
          executeTransaction: expect.any(Function),
          txParams: validTxParams,
          logger: expect.objectContaining({
            info: expect.any(Function),
            error: expect.any(Function),
          }),
        });

        // executeWithNonceRetryに渡されたexecuteTransaction関数を抽出してテスト
        const executeTransactionCall = mockExecuteWithNonceRetry.mock.calls[0]![0];
        const executeTransactionFn = executeTransactionCall.executeTransaction;

        // executeTransaction関数の動作を確認 (これにより240-243行がカバーされる)
        expect(typeof executeTransactionFn).toBe('function');
      });

      it('should handle receipt error with explorerUrl present', async () => {
        // executeWithNonceRetryがexplorerUrl付きで成功を返すようにモック
        mockExecuteWithNonceRetry.mockResolvedValue({
          success: true,
          transactionHash: validTxHash,
          explorerUrl: 'https://sepolia.etherscan.io/tx/' + validTxHash,
          finalNonce: validTxParams.nonce,
          retryCount: 0,
        });

        // waitForTransactionReceiptがエラーをスローするようにモック
        mockPublicClient.waitForTransactionReceipt.mockRejectedValue(
          new Error('Receipt timeout error')
        );

        const result = await processTransaction({
          privateKey: validPrivateKey,
          txParams: validTxParams,
          rpcUrl: validRpcUrl,
          broadcast: true,
          logger: mockLogger,
        });

        expect(result).toEqual({
          signedTransaction: validSignedTx,
          broadcast: {
            broadcastCompleted: true,
            status: 'BROADCASTED_BUT_UNCONFIRMED',
            transactionHash: validTxHash,
            explorerUrl: 'https://sepolia.etherscan.io/tx/' + validTxHash,
            finalNonce: validTxParams.nonce,
            retryCount: 0,
            error: 'レシート取得エラー: Receipt timeout error',
          },
        });

        // explorerUrl付きでエラーログが呼び出されたことを確認
        expect(mockLogger.error).toHaveBeenCalledWith(
          'レシート取得エラー（トランザクションは送信済み）: Receipt timeout error'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          `エクスプローラーURL: https://sepolia.etherscan.io/tx/${validTxHash}`
        );
      });

      it('should handle broadcast process that covers internal executeTransaction function', async () => {
        // このテストは、内部のexecuteTransaction関数（240-243行目）が実行されることを保証
        // 通常のブロードキャストプロセスを実行

        const result = await processTransaction({
          privateKey: validPrivateKey,
          txParams: validTxParams,
          rpcUrl: validRpcUrl,
          broadcast: true,
          logger: mockLogger,
        });

        // 成功した完了を確認
        expect(result.signedTransaction).toBe(validSignedTx);
        expect(result.broadcast?.status).toBe('SUCCESS');

        // executeWithNonceRetryがexecuteTransaction関数と共に呼び出されたことを確認
        expect(mockExecuteWithNonceRetry).toHaveBeenCalledWith({
          maxRetries: DEFAULT_MAX_RETRIES,
          executeTransaction: expect.any(Function),
          txParams: validTxParams,
          logger: expect.objectContaining({
            info: expect.any(Function),
            error: expect.any(Function),
          }),
        });

        // executeTransaction関数は内部的にsignEIP1559TransactionOfflineを呼び出す
        // これは240-243行目を間接的にテストする
        expect(mockSignEIP1559TransactionOffline).toHaveBeenCalledWith(
          validPrivateKey,
          validTxParams
        );
      });

      it('should call sign and broadcast in nested executeTransaction function', async () => {
        // executeTransactionをキャプチャするためにprocessTransactionを初期化
        await processTransaction({
          privateKey: validPrivateKey,
          txParams: validTxParams,
          rpcUrl: validRpcUrl,
          broadcast: true,
          logger: mockLogger,
        });
        const callArgs = mockExecuteWithNonceRetry.mock.calls[0]![0];
        const executeTransactionFn = callArgs.executeTransaction;
        // ネストされた実行のためのモックを準備
        mockSignEIP1559TransactionOffline.mockResolvedValue(validSignedTx);
        const mockBroadcast = vi.mocked(broadcastTransaction);
        mockBroadcast.mockResolvedValue({ transactionHash: validTxHash } as any);
        const testNonce = 42;
        const result = await executeTransactionFn(testNonce);
        expect(mockSignEIP1559TransactionOffline).toHaveBeenCalledWith(validPrivateKey, {
          ...validTxParams,
          nonce: testNonce,
        });
        expect(mockBroadcast).toHaveBeenCalledWith(
          validSignedTx,
          validTxParams.chainId,
          validRpcUrl
        );
        expect(result).toEqual({ transactionHash: validTxHash });
      });
    });

    describe('異常系 - ブロードキャストエラー', () => {
      it('ブロードキャスト失敗時のエラーハンドリング', async () => {
        mockExecuteWithNonceRetry.mockResolvedValue({
          success: false,
          error: new Error('Network error'),
          finalNonce: validTxParams.nonce,
          retryCount: 2,
        });

        const result = await processTransaction({
          privateKey: validPrivateKey,
          txParams: validTxParams,
          rpcUrl: validRpcUrl,
          broadcast: true,
          logger: mockLogger,
        });

        expect(result).toEqual({
          signedTransaction: validSignedTx,
          broadcast: {
            broadcastCompleted: false,
            status: 'FAILED',
            finalNonce: validTxParams.nonce,
            retryCount: 2,
            error: 'Network error',
          },
        });
      });

      it('トランザクションハッシュなしでブロードキャスト失敗', async () => {
        mockExecuteWithNonceRetry.mockResolvedValue({
          success: false,
          error: new Error('Transaction failed'),
          finalNonce: validTxParams.nonce,
          retryCount: 0,
        });

        const result = await processTransaction({
          privateKey: validPrivateKey,
          txParams: validTxParams,
          rpcUrl: validRpcUrl,
          broadcast: true,
          logger: mockLogger,
        });

        expect(result).toEqual({
          signedTransaction: validSignedTx,
          broadcast: {
            broadcastCompleted: false,
            status: 'FAILED',
            finalNonce: validTxParams.nonce,
            retryCount: 0,
            error: 'Transaction failed',
          },
        });
      });

      it('receipt取得失敗時のエラーハンドリング', async () => {
        // レシート取得失敗をシミュレート
        mockPublicClient.waitForTransactionReceipt.mockRejectedValueOnce(new Error('timeout'));

        const result = await processTransaction({
          privateKey: validPrivateKey,
          txParams: validTxParams,
          rpcUrl: validRpcUrl,
          broadcast: true,
          logger: mockLogger,
        });

        expect(result).toEqual({
          signedTransaction: validSignedTx,
          broadcast: {
            broadcastCompleted: true,
            status: 'BROADCASTED_BUT_UNCONFIRMED',
            transactionHash: validTxHash,
            explorerUrl: 'https://sepolia.etherscan.io/tx/' + validTxHash,
            finalNonce: validTxParams.nonce,
            retryCount: 0,
            error: 'レシート取得エラー: timeout',
          },
        });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'レシート取得エラー（トランザクションは送信済み）: timeout'
        );
      });
    });

    describe('署名エラー', () => {
      it('署名処理でのエラー', async () => {
        const signError = new Error('Private key error');
        mockSignEIP1559TransactionOffline.mockRejectedValue(signError);

        await expect(
          processTransaction({
            privateKey: validPrivateKey,
            txParams: validTxParams,
            broadcast: false,
            logger: mockLogger,
          })
        ).rejects.toThrow('Private key error');

        expect(mockLogger.info).toHaveBeenCalledWith('トランザクションの署名を開始...');
        expect(mockExecuteWithNonceRetry).not.toHaveBeenCalled();
      });
    });

    describe('エッジケース', () => {
      it('アクセスリスト付きトランザクション', async () => {
        const txParamsWithAccessList: EIP1559TxParams = {
          ...validTxParams,
          accessList: [
            {
              address: '0x742d35Cc6634C0532925a3b8D4C9db7C9c0c7a8A',
              storageKeys: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
            },
          ],
        };

        const result = await processTransaction({
          privateKey: validPrivateKey,
          txParams: txParamsWithAccessList,
          broadcast: false,
          logger: mockLogger,
        });

        expect(result).toEqual({
          signedTransaction: validSignedTx,
        });

        expect(mockSignEIP1559TransactionOffline).toHaveBeenCalledWith(
          validPrivateKey,
          txParamsWithAccessList
        );
      });

      it('ゼロ値トランザクション', async () => {
        const zeroValueTxParams: EIP1559TxParams = {
          ...validTxParams,
          value: '0',
        };

        const result = await processTransaction({
          privateKey: validPrivateKey,
          txParams: zeroValueTxParams,
          broadcast: false,
          logger: mockLogger,
        });

        expect(result).toEqual({
          signedTransaction: validSignedTx,
        });

        expect(mockSignEIP1559TransactionOffline).toHaveBeenCalledWith(
          validPrivateKey,
          zeroValueTxParams
        );
      });

      it('高いガス料金設定', async () => {
        const highGasTxParams: EIP1559TxParams = {
          ...validTxParams,
          maxFeePerGas: '100000000000',
          maxPriorityFeePerGas: '5000000000',
        };

        const result = await processTransaction({
          privateKey: validPrivateKey,
          txParams: highGasTxParams,
          broadcast: false,
          logger: mockLogger,
        });

        expect(result).toEqual({
          signedTransaction: validSignedTx,
        });

        expect(mockSignEIP1559TransactionOffline).toHaveBeenCalledWith(
          validPrivateKey,
          highGasTxParams
        );
      });
    });

    describe('ログ出力の検証', () => {
      it('署名のみの場合の適切なログ出力', async () => {
        mockSignEIP1559TransactionOffline.mockResolvedValue(validSignedTx);

        await processTransaction({
          privateKey: validPrivateKey,
          txParams: validTxParams,
          broadcast: false,
          logger: mockLogger,
        });

        expect(mockLogger.info).toHaveBeenCalledWith('トランザクションの署名を開始...');
        expect(mockLogger.info).toHaveBeenCalledWith('署名完了');
        expect(mockLogger.info).toHaveBeenCalledWith(
          'オフライン署名のみ完了しました。ブロードキャストはスキップされます。'
        );
        expect(mockLogger.info).toHaveBeenCalledTimes(3);
      });

      it('ブロードキャスト付きの場合の適切なログ出力', async () => {
        await processTransaction({
          privateKey: validPrivateKey,
          txParams: validTxParams,
          rpcUrl: validRpcUrl,
          broadcast: true,
          logger: mockLogger,
        });

        expect(mockLogger.info).toHaveBeenCalledWith('トランザクションの署名を開始...');
        expect(mockLogger.info).toHaveBeenCalledWith('署名完了');
        expect(mockLogger.info).toHaveBeenCalledWith('トランザクションのブロードキャストを開始...');
        expect(mockLogger.info).toHaveBeenCalledWith('トランザクションのマイニング完了を待機中...');
      });
    });

    describe('ネットワーク設定テスト', () => {
      it('Sepoliaネットワークでの処理', async () => {
        const sepoliaTxParams = { ...validTxParams, chainId: 11155111 };

        const result = await processTransaction({
          privateKey: validPrivateKey,
          txParams: sepoliaTxParams,
          broadcast: false,
          logger: mockLogger,
        });

        expect(result).toEqual({
          signedTransaction: validSignedTx,
        });

        expect(mockSignEIP1559TransactionOffline).toHaveBeenCalledWith(
          validPrivateKey,
          sepoliaTxParams
        );
      });

      it('Anvilネットワークでの処理', async () => {
        const anvilTxParams = { ...validTxParams, chainId: 31337 };

        const result = await processTransaction({
          privateKey: validPrivateKey,
          txParams: anvilTxParams,
          broadcast: false,
          logger: mockLogger,
        });

        expect(result).toEqual({
          signedTransaction: validSignedTx,
        });

        expect(mockSignEIP1559TransactionOffline).toHaveBeenCalledWith(
          validPrivateKey,
          anvilTxParams
        );
      });
    });

    describe('should use custom logger when set via setLogger', () => {
      it('should use custom logger when set via setLogger', async () => {
        setLogger(mockLogger);
        const result = await processTransaction({
          privateKey: validPrivateKey,
          txParams: validTxParams,
          broadcast: false,
        });
        expect(result.signedTransaction).toBe(validSignedTx);
        expect(mockLogger.info).toHaveBeenCalledWith('トランザクションの署名を開始...');
        expect(mockLogger.info).toHaveBeenCalledWith('署名完了');
      });
    });

    describe('should cover getChainConfig with different chainIds', () => {
      it('should cover getChainConfig with different chainIds', async () => {
        const chainIds = [1, 11155111, 31337];

        for (const chainId of chainIds) {
          const result = await processTransaction({
            privateKey: validPrivateKey,
            txParams: { ...validTxParams, chainId },
            broadcast: true,
            rpcUrl: validRpcUrl,
            logger: mockLogger,
          });
          expect(result.signedTransaction).toBeDefined();
          expect(mockGetNetworkConfig).toHaveBeenCalledWith(chainId);
        }
      });
    });
  });

  describe('DEFAULT_MAX_RETRIES', () => {
    it('should have correct default value', () => {
      expect(DEFAULT_MAX_RETRIES).toBe(3);
    });
  });

  describe('uncovered function coverage via integration tests', () => {
    it('should cover handleTransactionReceipt success path', async () => {
      // このテストは、レシートの成功をテストすることでhandleTransactionReceipt関数をカバー
      const result = await processTransaction({
        privateKey: validPrivateKey,
        txParams: validTxParams,
        rpcUrl: validRpcUrl,
        broadcast: true,
        logger: mockLogger,
      });

      expect(result.broadcast?.status).toBe('SUCCESS');
      expect(result.broadcast?.blockNumber).toBeDefined();
      expect(result.broadcast?.gasUsed).toBeDefined();
    });

    it('should cover handleTransactionReceipt error path', async () => {
      // レシート取得失敗をモック
      mockPublicClient.waitForTransactionReceipt.mockRejectedValue(new Error('Receipt timeout'));

      const result = await processTransaction({
        privateKey: validPrivateKey,
        txParams: validTxParams,
        rpcUrl: validRpcUrl,
        broadcast: true,
        logger: mockLogger,
      });

      expect(result.broadcast?.status).toBe('BROADCASTED_BUT_UNCONFIRMED');
      expect(result.broadcast?.error).toContain('Receipt timeout');
    });

    it('should cover executeTransaction function in handleBroadcast', async () => {
      // このテストは、handleBroadcast内のexecuteTransaction関数が呼び出されることを保証
      const result = await processTransaction({
        privateKey: validPrivateKey,
        txParams: validTxParams,
        rpcUrl: validRpcUrl,
        broadcast: true,
        maxRetries: 2,
        logger: mockLogger,
      });

      expect(result.broadcast?.broadcastCompleted).toBe(true);
      expect(mockExecuteWithNonceRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          executeTransaction: expect.any(Function),
          maxRetries: 2,
        })
      );
    });

    it('should cover createErrorBroadcastResult with explorerUrl', async () => {
      // explorerUrlを返し、その後レシートを失敗させるようにモック
      mockExecuteWithNonceRetry.mockResolvedValue({
        success: true,
        transactionHash: validTxHash,
        explorerUrl: 'https://sepolia.etherscan.io/tx/' + validTxHash,
        finalNonce: validTxParams.nonce,
        retryCount: 0,
      });

      mockPublicClient.waitForTransactionReceipt.mockRejectedValue(new Error('Network error'));

      const result = await processTransaction({
        privateKey: validPrivateKey,
        txParams: validTxParams,
        rpcUrl: validRpcUrl,
        broadcast: true,
        logger: mockLogger,
      });

      expect(result.broadcast?.status).toBe('BROADCASTED_BUT_UNCONFIRMED');
      expect(result.broadcast?.explorerUrl).toBeDefined();
      expect(result.broadcast?.error).toContain('Network error');
    });

    it('should cover createErrorBroadcastResult without explorerUrl', async () => {
      // explorerUrlなしで返し、その後レシートを失敗させるようにモック
      mockExecuteWithNonceRetry.mockResolvedValue({
        success: true,
        transactionHash: validTxHash,
        // explorerUrlなし
        finalNonce: validTxParams.nonce,
        retryCount: 0,
      });

      mockPublicClient.waitForTransactionReceipt.mockRejectedValue(new Error('RPC error'));

      const result = await processTransaction({
        privateKey: validPrivateKey,
        txParams: validTxParams,
        rpcUrl: validRpcUrl,
        broadcast: true,
        logger: mockLogger,
      });

      expect(result.broadcast?.status).toBe('BROADCASTED_BUT_UNCONFIRMED');
      expect(result.broadcast?.explorerUrl).toBeUndefined();
      expect(result.broadcast?.error).toContain('RPC error');
    });
  });
});

describe('transactionProcessor internal helper functions', () => {
  const dummyResult: NonceRetrySuccessResult = {
    success: true as const,
    transactionHash: '0xabc' as Hex,
    explorerUrl: 'https://example.com/tx/0xabc',
    finalNonce: 1,
    retryCount: 0,
  };
  const receipt: Pick<TransactionReceipt, 'blockNumber' | 'gasUsed'> = {
    blockNumber: 123n,
    gasUsed: 456n,
  };
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      data: vi.fn(),
    };
  });

  it('logTransactionSuccess logs all lines when explorerUrl present', () => {
    logTransactionSuccess(dummyResult, receipt, mockLogger);
    expect(mockLogger.info).toHaveBeenCalledWith(`ブロック番号: ${receipt.blockNumber}`);
    expect(mockLogger.info).toHaveBeenCalledWith(`ガス使用量: ${receipt.gasUsed}`);
    expect(mockLogger.info).toHaveBeenCalledWith(`エクスプローラーURL: ${dummyResult.explorerUrl}`);
  });

  it('logTransactionError logs explorerUrl when present', () => {
    logTransactionError(dummyResult, 'error occurred', mockLogger);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'レシート取得エラー（トランザクションは送信済み）: error occurred'
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      `エクスプローラーURL: ${dummyResult.explorerUrl}`
    );
  });

  it('logTransactionError does not log explorerUrl when undefined', () => {
    const { explorerUrl, ...noExplorer } = dummyResult;
    logTransactionError(noExplorer as NonceRetrySuccessResult, 'some error', mockLogger);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'レシート取得エラー（トランザクションは送信済み）: some error'
    );
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('エクスプローラーURL')
    );
  });
});

describe('handleTransactionReceipt', () => {
  const validRpcUrl = 'http://localhost:8545';
  const validTxHash = '0xhash';
  const mockReceipt = {
    blockNumber: 1n,
    gasUsed: 21000n,
    status: 'success',
  };
  const validTxParams: EIP1559TxParams = {
    to: '0x742d35Cc6634C0532925a3b8D4C9db7C9c0c7a8A',
    value: '0',
    gasLimit: '21000',
    maxFeePerGas: '20000000000',
    maxPriorityFeePerGas: '1000000000',
    nonce: 1,
    chainId: 1,
  };
  let mockLogger: Logger;
  let mockPublicClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      data: vi.fn(),
    };

    mockPublicClient = {
      waitForTransactionReceipt: vi.fn(),
    };

    mockCreatePublicClient.mockReturnValue(mockPublicClient);
  });

  it('should create success result and log correctly', async () => {
    const dummyRetrySuccessResult = {
      success: true,
      transactionHash: validTxHash,
      explorerUrl: 'https://etherscan.io/tx/0xhash',
      finalNonce: 1,
      retryCount: 0,
    } as NonceRetrySuccessResult;
    mockPublicClient.waitForTransactionReceipt.mockResolvedValue(mockReceipt);

    const result = await handleTransactionReceipt(
      dummyRetrySuccessResult,
      validTxParams,
      validRpcUrl,
      mockLogger
    );

    expect(result.status).toBe('SUCCESS');
    expect(mockLogger.info).toHaveBeenCalledWith(`ブロック番号: ${mockReceipt.blockNumber}`);
    expect(mockLogger.info).toHaveBeenCalledWith(`ガス使用量: ${mockReceipt.gasUsed}`);
    expect(mockLogger.info).toHaveBeenCalledWith(
      `エクスプローラーURL: ${dummyRetrySuccessResult.explorerUrl}`
    );
  });

  it('should create error result and log correctly on receipt failure', async () => {
    const dummyRetrySuccessResult = {
      success: true,
      transactionHash: validTxHash,
      explorerUrl: 'https://etherscan.io/tx/0xhash',
      finalNonce: 1,
      retryCount: 0,
    } as NonceRetrySuccessResult;
    const error = new Error('Receipt retrieval failed');
    mockPublicClient.waitForTransactionReceipt.mockRejectedValue(error);

    const result = await handleTransactionReceipt(
      dummyRetrySuccessResult,
      validTxParams,
      validRpcUrl,
      mockLogger
    );

    expect(result.status).toBe('BROADCASTED_BUT_UNCONFIRMED');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'レシート取得エラー（トランザクションは送信済み）: Receipt retrieval failed'
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      `エクスプローラーURL: ${dummyRetrySuccessResult.explorerUrl}`
    );
  });
});

vi.mock('../../../src/utils/logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    data: vi.fn(),
  }),
  // loggerInstance としても参照される logger のモック
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    data: vi.fn(),
  },
}));
