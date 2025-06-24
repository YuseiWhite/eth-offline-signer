import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Hex, PrivateKeyAccount, TransactionSerializableEIP1559 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { signEIP1559TransactionOffline } from '../../../src/core/signer';
import { SigningError } from '../../../src/utils/errors';
import type { EIP1559TxParams } from '../../../src/types/schema';

// viem/accounts のモック
vi.mock('viem/accounts');
const mockPrivateKeyToAccount = vi.mocked(privateKeyToAccount);

describe('signer', () => {
  const validPrivateKey =
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as const;
  const testAddress = '0x742d35cc6633c0532925a3b8d5c0e1985b0f8e7f' as Hex;
  const signedTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hex;

  const validTxParams: EIP1559TxParams = {
    to: '0x742d35cc6633c0532925a3b8d5c0e1985b0f8e7f',
    value: '1000000000000000000',
    chainId: 1,
    nonce: 1,
    gasLimit: '21000',
    maxFeePerGas: '30000000000',
    maxPriorityFeePerGas: '2000000000',
  };

  let mockAccount: PrivateKeyAccount;

  beforeEach(() => {
    vi.clearAllMocks();

    // モックアカウントの作成
    mockAccount = {
      address: testAddress,
      signTransaction: vi.fn().mockResolvedValue(signedTxHash),
      signMessage: vi.fn(),
      signTypedData: vi.fn(),
      type: 'local',
      source: 'privateKey',
    } as unknown as PrivateKeyAccount;

    mockPrivateKeyToAccount.mockReturnValue(mockAccount);
  });

  describe('signEIP1559TransactionOffline', () => {
    describe('正常系', () => {
      it('有効なEIP-1559トランザクションパラメータで署名を実行', async () => {
        const result = await signEIP1559TransactionOffline(validPrivateKey, validTxParams);

        expect(result).toBe(signedTxHash);
        expect(mockPrivateKeyToAccount).toHaveBeenCalledWith(validPrivateKey);
        expect(mockAccount.signTransaction).toHaveBeenCalledWith({
          to: validTxParams.to,
          value: BigInt(validTxParams.value),
          chainId: validTxParams.chainId,
          nonce: validTxParams.nonce,
          gas: BigInt(validTxParams.gasLimit),
          maxFeePerGas: BigInt(validTxParams.maxFeePerGas),
          maxPriorityFeePerGas: BigInt(validTxParams.maxPriorityFeePerGas),
          type: 'eip1559',
        });
      });

      it('アクセスリストを含むトランザクションを正常に署名', async () => {
        const txParamsWithAccessList: EIP1559TxParams = {
          ...validTxParams,
          accessList: [
            {
              address: '0x742d35cc6633c0532925a3b8d5c0e1985b0f8e7f',
              storageKeys: [
                '0x0000000000000000000000000000000000000000000000000000000000000001',
                '0x0000000000000000000000000000000000000000000000000000000000000002',
              ],
            },
          ],
        };

        const result = await signEIP1559TransactionOffline(validPrivateKey, txParamsWithAccessList);

        expect(result).toBe(signedTxHash);
        expect(mockAccount.signTransaction).toHaveBeenCalledWith({
          to: txParamsWithAccessList.to,
          value: BigInt(txParamsWithAccessList.value),
          chainId: txParamsWithAccessList.chainId,
          nonce: txParamsWithAccessList.nonce,
          gas: BigInt(txParamsWithAccessList.gasLimit),
          maxFeePerGas: BigInt(txParamsWithAccessList.maxFeePerGas),
          maxPriorityFeePerGas: BigInt(txParamsWithAccessList.maxPriorityFeePerGas),
          type: 'eip1559',
          accessList: [
            {
              address: '0x742d35cc6633c0532925a3b8d5c0e1985b0f8e7f',
              storageKeys: [
                '0x0000000000000000000000000000000000000000000000000000000000000001',
                '0x0000000000000000000000000000000000000000000000000000000000000002',
              ],
            },
          ],
        });
      });

      it('空のアクセスリストを含むトランザクションを正常に署名', async () => {
        const txParamsWithEmptyAccessList: EIP1559TxParams = {
          ...validTxParams,
          accessList: [],
        };

        const result = await signEIP1559TransactionOffline(
          validPrivateKey,
          txParamsWithEmptyAccessList
        );

        expect(result).toBe(signedTxHash);
        // 空のアクセスリストの場合、accessListフィールドは含まれない
        expect(mockAccount.signTransaction).toHaveBeenCalledWith({
          to: txParamsWithEmptyAccessList.to,
          value: BigInt(txParamsWithEmptyAccessList.value),
          chainId: txParamsWithEmptyAccessList.chainId,
          nonce: txParamsWithEmptyAccessList.nonce,
          gas: BigInt(txParamsWithEmptyAccessList.gasLimit),
          maxFeePerGas: BigInt(txParamsWithEmptyAccessList.maxFeePerGas),
          maxPriorityFeePerGas: BigInt(txParamsWithEmptyAccessList.maxPriorityFeePerGas),
          type: 'eip1559',
        });
      });

      it('ゼロ値のトランザクションを正常に署名', async () => {
        const zeroValueTxParams: EIP1559TxParams = {
          ...validTxParams,
          value: '0',
          nonce: 0,
          gasLimit: '21000',
          maxFeePerGas: '1000000000',
          maxPriorityFeePerGas: '1000000000',
        };

        const result = await signEIP1559TransactionOffline(validPrivateKey, zeroValueTxParams);

        expect(result).toBe(signedTxHash);
        expect(mockAccount.signTransaction).toHaveBeenCalledWith({
          to: zeroValueTxParams.to,
          value: BigInt(0),
          chainId: zeroValueTxParams.chainId,
          nonce: 0,
          gas: BigInt(21000),
          maxFeePerGas: BigInt(1000000000),
          maxPriorityFeePerGas: BigInt(1000000000),
          type: 'eip1559',
        });
      });

      it('大きな数値を含むトランザクションを正常に署名', async () => {
        const largeTxParams: EIP1559TxParams = {
          ...validTxParams,
          value: '999999999999999999999999999999999999999999999999999999999999',
          gasLimit: '10000000',
          maxFeePerGas: '100000000000',
          maxPriorityFeePerGas: '50000000000',
        };

        const result = await signEIP1559TransactionOffline(validPrivateKey, largeTxParams);

        expect(result).toBe(signedTxHash);
        expect(mockAccount.signTransaction).toHaveBeenCalledWith({
          to: largeTxParams.to,
          value: BigInt('999999999999999999999999999999999999999999999999999999999999'),
          chainId: largeTxParams.chainId,
          nonce: largeTxParams.nonce,
          gas: BigInt(10000000),
          maxFeePerGas: BigInt(100000000000),
          maxPriorityFeePerGas: BigInt(50000000000),
          type: 'eip1559',
        });
      });
    });

    describe('異常系 - アカウント作成エラー', () => {
      it('無効な秘密鍵でアカウント作成エラー', async () => {
        const error = new Error('Invalid private key');
        mockPrivateKeyToAccount.mockImplementation(() => {
          throw error;
        });

        await expect(signEIP1559TransactionOffline(validPrivateKey, validTxParams)).rejects.toThrow(
          SigningError
        );
        await expect(signEIP1559TransactionOffline(validPrivateKey, validTxParams)).rejects.toThrow(
          '秘密鍵からアカウントの作成に失敗しました: Invalid private key'
        );
      });

      it('privateKeyToAccountが文字列エラーをスロー', async () => {
        mockPrivateKeyToAccount.mockImplementation(() => {
          throw 'String error';
        });

        await expect(signEIP1559TransactionOffline(validPrivateKey, validTxParams)).rejects.toThrow(
          SigningError
        );
        await expect(signEIP1559TransactionOffline(validPrivateKey, validTxParams)).rejects.toThrow(
          '秘密鍵からアカウントの作成に失敗しました: String error'
        );
      });

      it('privateKeyToAccountがnullをスロー', async () => {
        mockPrivateKeyToAccount.mockImplementation(() => {
          throw null;
        });

        await expect(signEIP1559TransactionOffline(validPrivateKey, validTxParams)).rejects.toThrow(
          SigningError
        );
        await expect(signEIP1559TransactionOffline(validPrivateKey, validTxParams)).rejects.toThrow(
          '秘密鍵からアカウントの作成に失敗しました: null'
        );
      });
    });

    describe('異常系 - BigInt変換エラー', () => {
      it('無効なvalue文字列でBigInt変換エラー', async () => {
        const invalidTxParams: EIP1559TxParams = {
          ...validTxParams,
          value: 'invalid-number',
        };

        await expect(
          signEIP1559TransactionOffline(validPrivateKey, invalidTxParams)
        ).rejects.toThrow(SigningError);
        await expect(
          signEIP1559TransactionOffline(validPrivateKey, invalidTxParams)
        ).rejects.toThrow('valueのBigInt変換に失敗しました');
      });

      it('無効なgasLimit文字列でBigInt変換エラー', async () => {
        const invalidTxParams: EIP1559TxParams = {
          ...validTxParams,
          gasLimit: 'invalid-gas',
        };

        await expect(
          signEIP1559TransactionOffline(validPrivateKey, invalidTxParams)
        ).rejects.toThrow(SigningError);
        await expect(
          signEIP1559TransactionOffline(validPrivateKey, invalidTxParams)
        ).rejects.toThrow('gasLimitのBigInt変換に失敗しました');
      });

      it('無効なmaxFeePerGas文字列でBigInt変換エラー', async () => {
        const invalidTxParams: EIP1559TxParams = {
          ...validTxParams,
          maxFeePerGas: 'invalid-fee',
        };

        await expect(
          signEIP1559TransactionOffline(validPrivateKey, invalidTxParams)
        ).rejects.toThrow(SigningError);
        await expect(
          signEIP1559TransactionOffline(validPrivateKey, invalidTxParams)
        ).rejects.toThrow('maxFeePerGasのBigInt変換に失敗しました');
      });

      it('無効なmaxPriorityFeePerGas文字列でBigInt変換エラー', async () => {
        const invalidTxParams: EIP1559TxParams = {
          ...validTxParams,
          maxPriorityFeePerGas: 'invalid-priority',
        };

        await expect(
          signEIP1559TransactionOffline(validPrivateKey, invalidTxParams)
        ).rejects.toThrow(SigningError);
        await expect(
          signEIP1559TransactionOffline(validPrivateKey, invalidTxParams)
        ).rejects.toThrow('maxPriorityFeePerGasのBigInt変換に失敗しました');
      });
    });

    describe('異常系 - トランザクション署名エラー', () => {
      it('signTransactionでエラーが発生', async () => {
        const signingError = new Error('Transaction signing failed');
        mockAccount.signTransaction = vi.fn().mockRejectedValue(signingError);

        await expect(signEIP1559TransactionOffline(validPrivateKey, validTxParams)).rejects.toThrow(
          SigningError
        );
        await expect(signEIP1559TransactionOffline(validPrivateKey, validTxParams)).rejects.toThrow(
          'トランザクションの署名に失敗しました: Transaction signing failed'
        );
      });

      it('signTransactionで文字列エラーが発生', async () => {
        mockAccount.signTransaction = vi.fn().mockRejectedValue('String signing error');

        await expect(signEIP1559TransactionOffline(validPrivateKey, validTxParams)).rejects.toThrow(
          SigningError
        );
        await expect(signEIP1559TransactionOffline(validPrivateKey, validTxParams)).rejects.toThrow(
          'トランザクションの署名に失敗しました: String signing error'
        );
      });

      it('signTransactionでnullエラーが発生', async () => {
        mockAccount.signTransaction = vi.fn().mockRejectedValue(null);

        await expect(signEIP1559TransactionOffline(validPrivateKey, validTxParams)).rejects.toThrow(
          SigningError
        );
        await expect(signEIP1559TransactionOffline(validPrivateKey, validTxParams)).rejects.toThrow(
          'トランザクションの署名に失敗しました: null'
        );
      });
    });

    describe('エッジケース', () => {
      it('最大チェーンIDでトランザクションを署名', async () => {
        const maxChainIdTxParams: EIP1559TxParams = {
          ...validTxParams,
          chainId: Number.MAX_SAFE_INTEGER,
        };

        const result = await signEIP1559TransactionOffline(validPrivateKey, maxChainIdTxParams);

        expect(result).toBe(signedTxHash);
        expect(mockAccount.signTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            chainId: Number.MAX_SAFE_INTEGER,
          })
        );
      });

      it('最大nonceでトランザクションを署名', async () => {
        const maxNonceTxParams: EIP1559TxParams = {
          ...validTxParams,
          nonce: Number.MAX_SAFE_INTEGER,
        };

        const result = await signEIP1559TransactionOffline(validPrivateKey, maxNonceTxParams);

        expect(result).toBe(signedTxHash);
        expect(mockAccount.signTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            nonce: Number.MAX_SAFE_INTEGER,
          })
        );
      });

      it('複数のアクセスリスト項目を含むトランザクションを署名', async () => {
        const multiAccessListTxParams: EIP1559TxParams = {
          ...validTxParams,
          accessList: [
            {
              address: '0x742d35cc6633c0532925a3b8d5c0e1985b0f8e7f',
              storageKeys: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
            },
            {
              address: '0x8ba1f109551bD432803012645Hac136c',
              storageKeys: [
                '0x0000000000000000000000000000000000000000000000000000000000000002',
                '0x0000000000000000000000000000000000000000000000000000000000000003',
              ],
            },
          ],
        };

        const result = await signEIP1559TransactionOffline(
          validPrivateKey,
          multiAccessListTxParams
        );

        expect(result).toBe(signedTxHash);
        expect(mockAccount.signTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            accessList: multiAccessListTxParams.accessList,
          })
        );
      });
    });

    describe('型安全性の検証', () => {
      it('戻り値がHex型であることを確認', async () => {
        const result = await signEIP1559TransactionOffline(validPrivateKey, validTxParams);

        expect(typeof result).toBe('string');
        expect(result).toMatch(/^0x[0-9a-fA-F]+$/);
        expect(result).toBe(signedTxHash);
      });

      it('TransactionSerializableEIP1559型のオブジェクトが正しく構築される', async () => {
        await signEIP1559TransactionOffline(validPrivateKey, validTxParams);

        const expectedTransactionRequest: TransactionSerializableEIP1559 = {
          to: validTxParams.to as Hex,
          value: BigInt(validTxParams.value),
          chainId: validTxParams.chainId,
          nonce: validTxParams.nonce,
          gas: BigInt(validTxParams.gasLimit),
          maxFeePerGas: BigInt(validTxParams.maxFeePerGas),
          maxPriorityFeePerGas: BigInt(validTxParams.maxPriorityFeePerGas),
          type: 'eip1559',
        };

        expect(mockAccount.signTransaction).toHaveBeenCalledWith(expectedTransactionRequest);
      });
    });
  });
});
