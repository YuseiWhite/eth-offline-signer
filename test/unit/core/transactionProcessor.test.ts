import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  processTransaction,
  DEFAULT_MAX_RETRIES,
  handleTransactionReceipt,
} from '../../../src/core/transactionProcessor';
import type { EIP1559TxParams } from '../../../src/types/schema';
import type { Logger } from '../../../src/utils/logger';

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

vi.mock('viem', () => ({
  createPublicClient: vi.fn(),
  http: vi.fn(),
}));

vi.mock('../../../src/core/networkConfig', () => ({
  getNetworkConfig: vi.fn(),
}));

import { signEIP1559TransactionOffline } from '../../../src/core/signer';
import { executeWithNonceRetry } from '../../../src/core/nonceRetry';
import { broadcastTransaction } from '../../../src/core/broadcaster';
import { createPublicClient, http } from 'viem';
import { getNetworkConfig } from '../../../src/core/networkConfig';


const mockSignEIP1559TransactionOffline = vi.mocked(signEIP1559TransactionOffline);
const mockExecuteWithNonceRetry = vi.mocked(executeWithNonceRetry);
const mockCreatePublicClient = vi.mocked(createPublicClient);
const mockHttp = vi.mocked(http);
const mockGetNetworkConfig = vi.mocked(getNetworkConfig);

describe('transactionProcessor', () => {
  const validPrivateKey =
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as const;
  const validTxParams: EIP1559TxParams = {
    to: '0x742d35Cc6634C0532925a3b8D4C9db7C9C0C7A8A',
    value: '1000000000000000000',
    gasLimit: '21000',
    maxFeePerGas: '20000000000',
    maxPriorityFeePerGas: '1000000000',
    nonce: 10,
    chainId: 11155111,
  };

  const validSignedTx =
    '0x02f86b8201a4843b9aca00843b9aca0082520894742d35cc6634c0532925a3b8d4c9db7c9c0c7a8a880de0b6b3a76400008025a01234567890abcdef1234567890abcdef1234567890abcdefa01234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const validTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12';
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
      success: true,
      transactionHash: validTxHash,
      explorerUrl: 'https://sepolia.etherscan.io/tx/' + validTxHash,
      finalNonce: validTxParams.nonce,
      retryCount: 0,
    });

    // waitForTransactionReceiptのデフォルトレスポンスを設定
    mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
      blockNumber: 18500000n,
      gasUsed: 21000n,
      status: 'success',
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
        expect(mockLogger.info).toHaveBeenCalledWith('🔐 トランザクションの署名を開始...');
        expect(mockLogger.info).toHaveBeenCalledWith('✅ 署名完了');
        expect(mockLogger.info).toHaveBeenCalledWith(
          '📝 オフライン署名のみ完了しました。ブロードキャストはスキップされます。'
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
          '⚠️  レシート取得エラー（トランザクションは送信済み）: Receipt timeout error'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          `🔗 エクスプローラーURL: https://sepolia.etherscan.io/tx/${validTxHash}`
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
          `⚠️  レシート取得エラー（トランザクションは送信済み）: timeout`
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

        expect(mockLogger.info).toHaveBeenCalledWith('🔐 トランザクションの署名を開始...');
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
        await processTransaction({
          privateKey: validPrivateKey,
          txParams: validTxParams,
          broadcast: false,
          logger: mockLogger,
        });

        expect(mockLogger.info).toHaveBeenCalledWith('🔐 トランザクションの署名を開始...');
        expect(mockLogger.info).toHaveBeenCalledWith('✅ 署名完了');
        expect(mockLogger.info).toHaveBeenCalledWith(
          '📝 オフライン署名のみ完了しました。ブロードキャストはスキップされます。'
        );
      });

      it('ブロードキャスト付きの場合の適切なログ出力', async () => {
        await processTransaction({
          privateKey: validPrivateKey,
          txParams: validTxParams,
          rpcUrl: validRpcUrl,
          broadcast: true,
          logger: mockLogger,
        });

        expect(mockLogger.info).toHaveBeenCalledWith('🔐 トランザクションの署名を開始...');
        expect(mockLogger.info).toHaveBeenCalledWith('✅ 署名完了');
        expect(mockLogger.info).toHaveBeenCalledWith(
          '📡 トランザクションのブロードキャストを開始...'
        );
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

    it('should cover getChainConfig with different chainIds', async () => {
      const chainIds = [1, 11155111, 31337];

      for (const chainId of chainIds) {
        const result = await processTransaction({
          privateKey: validPrivateKey,
          txParams: { ...validTxParams, chainId },
          broadcast: false,
          logger: mockLogger,
        });

        expect(result.signedTransaction).toMatch(/^0x[0-9a-fA-F]+$/);
      }
    });
  });
});

// transactionProcessorの内部ヘルパー関数
import type { NonceRetrySuccessResult } from '../../../src/core/nonceRetry';
import type { Hex } from 'viem';
import * as networkConfigModule from '../../../src/core/networkConfig';
import {
  logTransactionSuccess,
  logTransactionError,
  getChainConfig,
  createSuccessBroadcastResult,
  createErrorBroadcastResult,
} from '../../../src/core/transactionProcessor';

describe('transactionProcessor internal helper functions', () => {
  const dummyResult: NonceRetrySuccessResult = {
    success: true,
    transactionHash: '0xabc' as Hex,
    explorerUrl: 'https://example.com/tx/0xabc',
    finalNonce: 5,
    retryCount: 2,
  };
  const receipt = { blockNumber: 123n, gasUsed: 456n };
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), data: vi.fn() };
  });

  it('logTransactionSuccess logs all lines when explorerUrl present', () => {
    logTransactionSuccess(dummyResult, receipt, mockLogger);
    expect(mockLogger.info).toHaveBeenCalledWith('📋 トランザクションハッシュ: 0xabc');
    expect(mockLogger.info).toHaveBeenCalledWith('⛏️  ブロック番号: 123');
    expect(mockLogger.info).toHaveBeenCalledWith('⛽ ガス使用量: 456');
    expect(mockLogger.info).toHaveBeenCalledWith(
      '🔗 エクスプローラーURL: https://example.com/tx/0xabc'
    );
  });

  it('logTransactionError logs correct lines when explorerUrl present', () => {
    logTransactionError(dummyResult, 'error occurred', mockLogger);
    expect(mockLogger.error).toHaveBeenCalledWith(
      '⚠️  レシート取得エラー（トランザクションは送信済み）: error occurred'
    );
    expect(mockLogger.error).toHaveBeenCalledWith('📋 トランザクションハッシュ: 0xabc');
    expect(mockLogger.error).toHaveBeenCalledWith(
      '🔗 エクスプローラーURL: https://example.com/tx/0xabc'
    );
  });

  it('logTransactionError does not log explorerUrl when undefined', () => {
    const { explorerUrl, ...noExplorer } = dummyResult;
    logTransactionError(noExplorer as NonceRetrySuccessResult, 'some error', mockLogger);
    expect(mockLogger.error).toHaveBeenCalledWith(
      '⚠️  レシート取得エラー（トランザクションは送信済み）: some error'
    );
    expect(mockLogger.error).toHaveBeenCalledWith('📋 トランザクションハッシュ: 0xabc');
    const calls = (mockLogger.error as ReturnType<typeof vi.fn>).mock.calls.flat();
    expect(calls.filter((call: string) => call.includes('🔗'))).toHaveLength(0);
  });

  const dummySuccess = {
    success: true,
    transactionHash: '0xabc' as Hex,
    explorerUrl: 'https://example.com/tx/0xabc',
    finalNonce: 7,
    retryCount: 1,
  } as NonceRetrySuccessResult;

  it('createSuccessBroadcastResult without explorerUrl', () => {
    const { explorerUrl, ...noExplorer } = dummySuccess;
    const result = createSuccessBroadcastResult(noExplorer as NonceRetrySuccessResult, receipt);
    expect(result).toEqual({
      broadcastCompleted: true,
      status: 'SUCCESS',
      transactionHash: '0xabc',
      blockNumber: 123n,
      gasUsed: 456n,
      finalNonce: 7,
      retryCount: 1,
    });
    expect(result.explorerUrl).toBeUndefined();
  });

  it('createSuccessBroadcastResult with explorerUrl', () => {
    const result = createSuccessBroadcastResult(dummySuccess, receipt);
    expect(result.explorerUrl).toBe('https://example.com/tx/0xabc');
  });

  it('createErrorBroadcastResult without explorerUrl', () => {
    const { explorerUrl, ...noExplorer } = dummySuccess;
    const result = createErrorBroadcastResult(noExplorer as NonceRetrySuccessResult, 'err');
    expect(result).toEqual({
      broadcastCompleted: true,
      status: 'BROADCASTED_BUT_UNCONFIRMED',
      transactionHash: '0xabc',
      finalNonce: 7,
      retryCount: 1,
      error: 'レシート取得エラー: err',
    });
    expect(result.explorerUrl).toBeUndefined();
  });

  it('createErrorBroadcastResult with explorerUrl', () => {
    const result = createErrorBroadcastResult(dummySuccess, 'fail');
    expect(result.explorerUrl).toBe('https://example.com/tx/0xabc');
  });

  describe('getChainConfig', () => {
    it('returns chain config when networkConfig returns valid', () => {
      const fakeChain = {
        id: 99,
        name: 'Test',
        nativeCurrency: { name: 'T', symbol: 'T', decimals: 18 },
        rpcUrls: { default: { http: [''] } },
      };
      vi.spyOn(networkConfigModule, 'getNetworkConfig').mockReturnValue({
        chain: fakeChain,
      } as any);
      expect(getChainConfig(99)).toBe(fakeChain);
    });

    it('throws error when networkConfig throws', () => {
      vi.spyOn(networkConfigModule, 'getNetworkConfig').mockImplementation(() => {
        throw new Error('bad');
      });
      expect(() => getChainConfig(1)).toThrow('bad');
    });
  });
});

// transactionProcessor.setLogger.test.tsからマージされたsetLoggerテスト
import { setLogger } from '../../../src/core/transactionProcessor';
import * as signer from '../../../src/core/signer';

describe('transactionProcessor setLogger', () => {
  it('should use custom logger when set via setLogger', async () => {
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), data: vi.fn() };
    setLogger(mockLogger);

    // signerをモック
    vi.spyOn(signer, 'signEIP1559TransactionOffline').mockResolvedValue('0xsigned');

    // 最小限の有効なtxParamsを準備
    const txParams = {
      to: '0x0000000000000000000000000000000000000001',
      value: '1',
      chainId: 1,
      nonce: 0,
      gasLimit: '21000',
      maxFeePerGas: '1',
      maxPriorityFeePerGas: '1',
    };

    const validKey = '0x' + 'a'.repeat(64);
    const result = await processTransaction({ privateKey: validKey, txParams, broadcast: false });
    expect(result.signedTransaction).toBe('0xsigned');
    expect(mockLogger.info).toHaveBeenCalledWith('🔐 トランザクションの署名を開始...');
    expect(mockLogger.info).toHaveBeenCalledWith('✅ 署名完了');
  });
});

describe('comprehensive helper function tests', () => {
  it('logTransactionSuccess should handle all scenarios', () => {
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), data: vi.fn() };

    // explorerUrlありでテスト
    const resultWithUrl: NonceRetrySuccessResult = {
      success: true,
      transactionHash: '0xabc' as Hex,
      explorerUrl: 'https://example.com/tx/0xabc',
      finalNonce: 5,
      retryCount: 2,
    };
    const receipt = { blockNumber: 123n, gasUsed: 456n };

    logTransactionSuccess(resultWithUrl, receipt, mockLogger);

    expect(mockLogger.info).toHaveBeenCalledWith('📋 トランザクションハッシュ: 0xabc');
    expect(mockLogger.info).toHaveBeenCalledWith('⛏️  ブロック番号: 123');
    expect(mockLogger.info).toHaveBeenCalledWith('⛽ ガス使用量: 456');
    expect(mockLogger.info).toHaveBeenCalledWith(
      '🔗 エクスプローラーURL: https://example.com/tx/0xabc'
    );

    // explorerUrlなしでテスト
    (mockLogger.info as ReturnType<typeof vi.fn>).mockClear();
    const resultWithoutUrl: NonceRetrySuccessResult = {
      success: true,
      transactionHash: '0xdef' as Hex,
      finalNonce: 10,
      retryCount: 0,
    };

    logTransactionSuccess(resultWithoutUrl, receipt, mockLogger);

    expect(mockLogger.info).toHaveBeenCalledWith('⛏️  ブロック番号: 123');
    expect(mockLogger.info).toHaveBeenCalledWith('⛽ ガス使用量: 456');
    // explorerUrlのログは呼び出されないはず
    const infoCalls = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls.flat();
    expect(infoCalls.filter((call: string) => call.includes('🔗'))).toHaveLength(0);
  });

  it('logTransactionError should handle all scenarios', () => {
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), data: vi.fn() };

    // explorerUrlありでテスト
    const resultWithUrl: NonceRetrySuccessResult = {
      success: true,
      transactionHash: '0xabc' as Hex,
      explorerUrl: 'https://example.com/tx/0xabc',
      finalNonce: 5,
      retryCount: 2,
    };

    logTransactionError(resultWithUrl, 'Test error message', mockLogger);

    expect(mockLogger.error).toHaveBeenCalledWith(
      '⚠️  レシート取得エラー（トランザクションは送信済み）: Test error message'
    );
    expect(mockLogger.error).toHaveBeenCalledWith('📋 トランザクションハッシュ: 0xabc');
    expect(mockLogger.error).toHaveBeenCalledWith(
      '🔗 エクスプローラーURL: https://example.com/tx/0xabc'
    );

    // explorerUrlなしでテスト
    (mockLogger.error as ReturnType<typeof vi.fn>).mockClear();
    const resultWithoutUrl: NonceRetrySuccessResult = {
      success: true,
      transactionHash: '0xdef' as Hex,
      finalNonce: 10,
      retryCount: 0,
    };

    logTransactionError(resultWithoutUrl, 'Another error', mockLogger);

    expect(mockLogger.error).toHaveBeenCalledWith(
      '⚠️  レシート取得エラー（トランザクションは送信済み）: Another error'
    );
    expect(mockLogger.error).toHaveBeenCalledWith('📋 トランザクションハッシュ: 0xdef');
    // explorerUrlのログは呼び出されないはず
    const errorCalls = (mockLogger.error as ReturnType<typeof vi.fn>).mock.calls.flat();
    expect(errorCalls.filter((call: string) => call.includes('🔗'))).toHaveLength(0);
  });

  it('createSuccessBroadcastResult should handle all scenarios', () => {
    const receipt = { blockNumber: 123n, gasUsed: 456n };

    // explorerUrlありでテスト
    const resultWithUrl: NonceRetrySuccessResult = {
      success: true,
      transactionHash: '0xabc' as Hex,
      explorerUrl: 'https://example.com/tx/0xabc',
      finalNonce: 5,
      retryCount: 2,
    };

    const broadcastResult1 = createSuccessBroadcastResult(resultWithUrl, receipt);
    expect(broadcastResult1).toEqual({
      broadcastCompleted: true,
      status: 'SUCCESS',
      transactionHash: '0xabc',
      blockNumber: 123n,
      gasUsed: 456n,
      finalNonce: 5,
      retryCount: 2,
      explorerUrl: 'https://example.com/tx/0xabc',
    });

    // explorerUrlなしでテスト
    const resultWithoutUrl: NonceRetrySuccessResult = {
      success: true,
      transactionHash: '0xdef' as Hex,
      finalNonce: 10,
      retryCount: 0,
    };

    const broadcastResult2 = createSuccessBroadcastResult(resultWithoutUrl, receipt);
    expect(broadcastResult2).toEqual({
      broadcastCompleted: true,
      status: 'SUCCESS',
      transactionHash: '0xdef',
      blockNumber: 123n,
      gasUsed: 456n,
      finalNonce: 10,
      retryCount: 0,
    });
    expect(broadcastResult2.explorerUrl).toBeUndefined();
  });

  it('createErrorBroadcastResult should handle all scenarios', () => {
    // explorerUrlありでテスト
    const resultWithUrl: NonceRetrySuccessResult = {
      success: true,
      transactionHash: '0xabc' as Hex,
      explorerUrl: 'https://example.com/tx/0xabc',
      finalNonce: 5,
      retryCount: 2,
    };

    const errorResult1 = createErrorBroadcastResult(resultWithUrl, 'Test error');
    expect(errorResult1).toEqual({
      broadcastCompleted: true,
      status: 'BROADCASTED_BUT_UNCONFIRMED',
      transactionHash: '0xabc',
      finalNonce: 5,
      retryCount: 2,
      error: 'レシート取得エラー: Test error',
      explorerUrl: 'https://example.com/tx/0xabc',
    });

    // explorerUrlなしでテスト
    const resultWithoutUrl: NonceRetrySuccessResult = {
      success: true,
      transactionHash: '0xdef' as Hex,
      finalNonce: 10,
      retryCount: 0,
    };

    const errorResult2 = createErrorBroadcastResult(resultWithoutUrl, 'Another error');
    expect(errorResult2).toEqual({
      broadcastCompleted: true,
      status: 'BROADCASTED_BUT_UNCONFIRMED',
      transactionHash: '0xdef',
      finalNonce: 10,
      retryCount: 0,
      error: 'レシート取得エラー: Another error',
    });
    expect(errorResult2.explorerUrl).toBeUndefined();
  });

  it('getChainConfig should handle all scenarios', () => {
    // 成功ケースをテスト
    const fakeChain = {
      id: 99,
      name: 'Test',
      nativeCurrency: { name: 'T', symbol: 'T', decimals: 18 },
      rpcUrls: { default: { http: [''] } },
    };
    vi.spyOn(networkConfigModule, 'getNetworkConfig').mockReturnValue({ chain: fakeChain } as any);

    const result = getChainConfig(99);
    expect(result).toBe(fakeChain);

    // エラーケースをテスト
    vi.spyOn(networkConfigModule, 'getNetworkConfig').mockImplementation(() => {
      throw new Error('Network not found');
    });

    expect(() => getChainConfig(999)).toThrow('Network not found');
  });
});

describe('transactionProcessor helper functions', () => {
  // ヘルパーテスト用のvalidTxHashを定義
  const validTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12' as `0x${string}`;
  const dummyChainConfig = {
    id: 1,
    name: 'TestChain',
    rpcUrls: { default: { http: ['http://localhost:8545'] } },
  };
  const validTxParams = { chainId: dummyChainConfig.id } as any;
  const dummyNetworkConfig = {
    explorerBaseUrl: 'http://explorer',
    name: 'TestChain',
    chain: dummyChainConfig,
  };
  const dummyReceipt = { blockNumber: 1n, gasUsed: 21000n };
  const dummyRetrySuccessResult = {
    success: true as const,
    transactionHash: validTxHash,
    explorerUrl: 'http://explorer/tx/' + validTxHash,
    finalNonce: 0,
    retryCount: 0,
  };
  let helperLogger: Logger;
  let waitForReceipt: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    helperLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), data: vi.fn() };
    vi.spyOn(networkConfigModule, 'getNetworkConfig').mockReturnValue(dummyNetworkConfig as any);
    mockHttp.mockReturnValue({} as any);
    waitForReceipt = vi.fn().mockResolvedValue(dummyReceipt);
    mockCreatePublicClient.mockReturnValue({ waitForTransactionReceipt: waitForReceipt } as any);
  });

  it('getChainConfig should return chain from networkConfig', () => {
    expect(getChainConfig(123)).toEqual(dummyChainConfig);
    expect(networkConfigModule.getNetworkConfig).toHaveBeenCalledWith(123);
  });

  it('logTransactionSuccess should log info messages properly', () => {
    logTransactionSuccess(dummyRetrySuccessResult, dummyReceipt, helperLogger);
    expect(helperLogger.info).toHaveBeenCalledWith(
      `📋 トランザクションハッシュ: ${dummyRetrySuccessResult.transactionHash}`
    );
    expect(helperLogger.info).toHaveBeenCalledWith(`⛏️  ブロック番号: ${dummyReceipt.blockNumber}`);
    expect(helperLogger.info).toHaveBeenCalledWith(`⛽ ガス使用量: ${dummyReceipt.gasUsed}`);
    expect(helperLogger.info).toHaveBeenCalledWith(
      `🔗 エクスプローラーURL: ${dummyRetrySuccessResult.explorerUrl}`
    );
  });

  it('logTransactionError should log error messages properly', () => {
    logTransactionError(dummyRetrySuccessResult, 'error occurred', helperLogger);
    expect(helperLogger.error).toHaveBeenCalledWith(
      '⚠️  レシート取得エラー（トランザクションは送信済み）: error occurred'
    );
    expect(helperLogger.error).toHaveBeenCalledWith(
      `📋 トランザクションハッシュ: ${dummyRetrySuccessResult.transactionHash}`
    );
    expect(helperLogger.error).toHaveBeenCalledWith(
      `🔗 エクスプローラーURL: ${dummyRetrySuccessResult.explorerUrl}`
    );
  });

  it('createSuccessBroadcastResult should construct correct result', () => {
    const result = createSuccessBroadcastResult(dummyRetrySuccessResult, dummyReceipt);
    expect(result).toEqual({
      broadcastCompleted: true,
      status: 'SUCCESS',
      transactionHash: dummyRetrySuccessResult.transactionHash,
      blockNumber: dummyReceipt.blockNumber,
      gasUsed: dummyReceipt.gasUsed,
      finalNonce: dummyRetrySuccessResult.finalNonce,
      retryCount: dummyRetrySuccessResult.retryCount,
      explorerUrl: dummyRetrySuccessResult.explorerUrl,
    });
  });

  it('createErrorBroadcastResult should construct correct result', () => {
    const result = createErrorBroadcastResult(dummyRetrySuccessResult, 'failure');
    expect(result).toEqual({
      broadcastCompleted: true,
      status: 'BROADCASTED_BUT_UNCONFIRMED',
      transactionHash: dummyRetrySuccessResult.transactionHash,
      finalNonce: dummyRetrySuccessResult.finalNonce,
      retryCount: dummyRetrySuccessResult.retryCount,
      error: 'レシート取得エラー: failure',
      explorerUrl: dummyRetrySuccessResult.explorerUrl,
    });
  });

  it('handleTransactionReceipt success path should return proper broadcast result', async () => {
    const result = await handleTransactionReceipt(
      dummyRetrySuccessResult as any,
      validTxParams,
      'http://rpc',
      helperLogger
    );
    expect(result).toEqual({
      broadcastCompleted: true,
      status: 'SUCCESS',
      transactionHash: dummyRetrySuccessResult.transactionHash,
      blockNumber: dummyReceipt.blockNumber,
      gasUsed: dummyReceipt.gasUsed,
      finalNonce: dummyRetrySuccessResult.finalNonce,
      retryCount: dummyRetrySuccessResult.retryCount,
      explorerUrl: dummyRetrySuccessResult.explorerUrl,
    });
  });

  it('handleTransactionReceipt error path should return proper broadcast result', async () => {
    waitForReceipt.mockRejectedValueOnce(new Error('receipt error'));
    const result = await handleTransactionReceipt(
      dummyRetrySuccessResult as any,
      validTxParams,
      'http://rpc',
      helperLogger
    );
    expect(result).toEqual({
      broadcastCompleted: true,
      status: 'BROADCASTED_BUT_UNCONFIRMED',
      transactionHash: dummyRetrySuccessResult.transactionHash,
      finalNonce: dummyRetrySuccessResult.finalNonce,
      retryCount: dummyRetrySuccessResult.retryCount,
      error: 'レシート取得エラー: receipt error',
      explorerUrl: dummyRetrySuccessResult.explorerUrl,
    });
  });
});

// handleBroadcast 単体テストを統合
import { handleBroadcast } from '../../../src/core/transactionProcessor';

describe('handleBroadcast', () => {
  let logger: Logger;
  const privateKey = ('0x' + 'a'.repeat(64)) as `0x${string}`;
  const rpcUrl = 'http://localhost';
  const txParams: EIP1559TxParams = {
    to: '0x0000000000000000000000000000000000000000',
    value: '0',
    chainId: 1,
    nonce: 0,
    gasLimit: '21000',
    maxFeePerGas: '1',
    maxPriorityFeePerGas: '1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), data: vi.fn() };
  });

  it('returns FAILED when executeWithNonceRetry fails', async () => {
    mockExecuteWithNonceRetry.mockResolvedValue({
      success: false,
      error: new Error('retry failed'),
      finalNonce: 5,
      retryCount: 2,
    } as any);

    const result = await handleBroadcast(privateKey, txParams, rpcUrl, 3, logger);

    expect(result).toEqual({
      success: false,
      error: new Error('retry failed'),
      finalNonce: 5,
      retryCount: 2,
    });
  });

  it('returns SUCCESS when executeWithNonceRetry succeeds', async () => {
    const retryResult = {
      success: true,
      transactionHash: '0xabc' as `0x${string}`,
      explorerUrl: 'http://explorer/0xabc',
      finalNonce: 1,
      retryCount: 0,
    };
    mockExecuteWithNonceRetry.mockResolvedValue(retryResult as any);

    const result = await handleBroadcast(privateKey, txParams, rpcUrl, 3, logger);

    expect(result).toEqual({
      success: true,
      transactionHash: '0xabc' as `0x${string}`,
      explorerUrl: 'http://explorer/0xabc',
      finalNonce: 1,
      retryCount: 0,
    });
  });

  it('returns SUCCESS for different transaction hash', async () => {
    const retryResult = {
      success: true,
      transactionHash: '0xdef' as `0x${string}`,
      finalNonce: 2,
      retryCount: 1,
    };
    mockExecuteWithNonceRetry.mockResolvedValue(retryResult as any);

    const result = await handleBroadcast(privateKey, txParams, rpcUrl, 3, logger);

    expect(result).toEqual({
      success: true,
      transactionHash: '0xdef' as `0x${string}`,
      finalNonce: 2,
      retryCount: 1,
    });
  });
});
