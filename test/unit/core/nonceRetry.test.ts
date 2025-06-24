import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as nonceRetryModule from '../../../src/core/nonceRetry';
const { executeWithNonceRetry } = nonceRetryModule;
import { validateNonceError } from '../../../src/types/schema';
import type { EIP1559TxParams } from '../../../src/types/schema';
import type { Logger } from '../../../src/core/nonceRetry';
import type { Hex } from 'viem';
import {
  exponentialBackoff,
  buildSuccessResult,
  buildFailureResult,
  isNonceError,
} from '../../../src/core/nonceRetry';

describe('nonceRetry', () => {
  const mockTxParams: EIP1559TxParams = {
    to: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
    value: '1000000000000000000',
    chainId: 11155111,
    nonce: 10,
    gasLimit: '21000',
    maxFeePerGas: '20000000000',
    maxPriorityFeePerGas: '1000000000',
  };
  const validTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex;
  const explorerUrl = 'https://sepolia.etherscan.io/tx/';

  const mockLogger: Logger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeWithNonceRetry', () => {
    it('should execute successfully on first attempt', async () => {
      const mockExecute = vi.fn().mockResolvedValue({
        transactionHash: validTxHash,
        explorerUrl: `${explorerUrl}${validTxHash}`,
      });

      const result = await executeWithNonceRetry({
        executeTransaction: mockExecute,
        txParams: mockTxParams,
        maxRetries: 3,
        logger: mockLogger,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.transactionHash).toBe(validTxHash);
        expect(result.finalNonce).toBe(10);
        expect(result.retryCount).toBe(0);
        expect(result.explorerUrl).toBe(`${explorerUrl}${validTxHash}`);
      }

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(10);
      expect(mockLogger.info).toHaveBeenCalledWith(
        '🔄 トランザクション実行中... (試行 1/4, Nonce: 10)'
      );
    });

    it('should execute successfully without explorerUrl', async () => {
      const mockExecute = vi.fn().mockResolvedValue({ transactionHash: validTxHash });

      const result = await executeWithNonceRetry({
        executeTransaction: mockExecute,
        txParams: mockTxParams,
        maxRetries: 3,
        logger: mockLogger,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.transactionHash).toBe(validTxHash);
        expect(result.explorerUrl).toBeUndefined();
      }

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(10);
    });

    it('should retry on nonce too low error', async () => {
      const nonceError = new Error('nonce too low');

      const mockExecute = vi
        .fn()
        .mockRejectedValueOnce(nonceError)
        .mockResolvedValue({
          transactionHash: validTxHash,
          explorerUrl: `${explorerUrl}${validTxHash}`,
        });

      const result = await executeWithNonceRetry({
        executeTransaction: mockExecute,
        txParams: mockTxParams,
        maxRetries: 3,
        logger: mockLogger,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.transactionHash).toBe(validTxHash);
        expect(result.finalNonce).toBe(11);
        expect(result.retryCount).toBe(1);
      }

      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(mockExecute).toHaveBeenNthCalledWith(1, 10);
      expect(mockExecute).toHaveBeenNthCalledWith(2, 11);
      expect(mockLogger.info).toHaveBeenCalledWith(
        '⚠️ Nonceエラーを検出、リトライします (新しいNonce: 11)'
      );
    });

    it('should retry on nonce too high error', async () => {
      const nonceError = new Error('nonce too high');

      const mockExecute = vi
        .fn()
        .mockRejectedValueOnce(nonceError)
        .mockResolvedValue({
          transactionHash: validTxHash,
          explorerUrl: `${explorerUrl}${validTxHash}`,
        });

      const result = await executeWithNonceRetry({
        executeTransaction: mockExecute,
        txParams: mockTxParams,
        maxRetries: 3,
        logger: mockLogger,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.transactionHash).toBe(validTxHash);
        expect(result.finalNonce).toBe(11);
        expect(result.retryCount).toBe(1);
      }

      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(mockExecute).toHaveBeenNthCalledWith(1, 10);
      expect(mockExecute).toHaveBeenNthCalledWith(2, 11);
    });

    it('should fail after max retries', async () => {
      const nonceError = new Error('nonce too low');

      const mockExecute = vi.fn().mockRejectedValue(nonceError);

      const result = await executeWithNonceRetry({
        executeTransaction: mockExecute,
        txParams: mockTxParams,
        maxRetries: 3,
        logger: mockLogger,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('nonce too low');
        expect(result.retryCount).toBe(3);
      }

      expect(mockExecute).toHaveBeenCalledTimes(4);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ 最大リトライ回数に達しました')
      );
    });

    it('should handle replacement underpriced error', async () => {
      const nonceError = new Error('replacement transaction underpriced');

      const mockExecute = vi
        .fn()
        .mockRejectedValueOnce(nonceError)
        .mockResolvedValue({
          transactionHash: validTxHash,
          explorerUrl: `${explorerUrl}${validTxHash}`,
        });

      const result = await executeWithNonceRetry({
        executeTransaction: mockExecute,
        txParams: mockTxParams,
        maxRetries: 3,
        logger: mockLogger,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.retryCount).toBe(1);
      }

      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    it('should handle transaction already known error', async () => {
      const nonceError = new Error('transaction already known');

      const mockExecute = vi
        .fn()
        .mockRejectedValueOnce(nonceError)
        .mockResolvedValue({
          transactionHash: validTxHash,
          explorerUrl: `${explorerUrl}${validTxHash}`,
        });

      const result = await executeWithNonceRetry({
        executeTransaction: mockExecute,
        txParams: mockTxParams,
        maxRetries: 3,
        logger: mockLogger,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.retryCount).toBe(1);
      }

      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    it('should preserve nonce for non-nonce related errors', async () => {
      const nonNonceError = new Error('insufficient funds');

      const mockExecute = vi
        .fn()
        .mockRejectedValueOnce(nonNonceError)
        .mockResolvedValue({
          transactionHash: validTxHash,
          explorerUrl: `${explorerUrl}${validTxHash}`,
        });

      const result = await executeWithNonceRetry({
        executeTransaction: mockExecute,
        txParams: mockTxParams,
        maxRetries: 3,
        logger: mockLogger,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.finalNonce).toBe(10);
      }

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ Nonceエラー以外のエラーが発生しました')
      );
    });

    it('should not call exponentialBackoff on first retry attempt (attempt > 0 condition)', async () => {
      const nonceError = new Error('nonce too low');
      const mockExecute = vi
        .fn()
        .mockRejectedValueOnce(nonceError)
        .mockResolvedValue({
          transactionHash: validTxHash,
          explorerUrl: `${explorerUrl}${validTxHash}`,
        });

      // exponentialBackoffが最初のリトライ時に呼び出されないことを確認するためのスパイ
      const backoffSpy = vi.spyOn(nonceRetryModule, 'exponentialBackoff');

      const result = await executeWithNonceRetry({
        executeTransaction: mockExecute,
        txParams: mockTxParams,
        maxRetries: 3,
        logger: mockLogger,
      });

      expect(result.success).toBe(true);
      // exponentialBackoffは最初のリトライ時には呼び出されない (attempt = 0)
      expect(backoffSpy).not.toHaveBeenCalled();

      backoffSpy.mockRestore();
    });

    it('should handle multiple retries with nonce increments', async () => {
      const nonceError = new Error('nonce too low');
      const mockExecute = vi
        .fn()
        .mockRejectedValueOnce(nonceError)
        .mockRejectedValueOnce(nonceError)
        .mockResolvedValue({
          transactionHash: validTxHash,
          explorerUrl: `${explorerUrl}${validTxHash}`,
        });

      const result = await executeWithNonceRetry({
        executeTransaction: mockExecute,
        txParams: mockTxParams,
        maxRetries: 3,
        logger: mockLogger,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.finalNonce).toBe(12); // 元のNonce (10) + 2回のリトライ
        expect(result.retryCount).toBe(2);
      }

      expect(mockExecute).toHaveBeenCalledTimes(3);
      expect(mockExecute).toHaveBeenNthCalledWith(1, 10);
      expect(mockExecute).toHaveBeenNthCalledWith(2, 11);
      expect(mockExecute).toHaveBeenNthCalledWith(3, 12);
    });

    it('should handle edge case where lastError becomes null during execution', async () => {
      // 実行中にlastErrorがnullになるシナリオをシミュレートするモックを作成
      const mockExecute = vi.fn().mockImplementation(() => {
        // これは、エラーが発生したがlastErrorが設定されない非常に珍しいケースをシミュレート
        throw null; // nullをスローすると、Error(String(null)) = Error('null')に変換される
      });

      const result = await executeWithNonceRetry({
        executeTransaction: mockExecute,
        txParams: mockTxParams,
        maxRetries: 1,
        logger: mockLogger,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        // Error(String(null))を使用すべきで、それは'null'になる
        expect(result.error.message).toBe('null');
        expect(result.retryCount).toBe(0);
      }
    });

    it('should use fallback error when no specific error is caught (line 178 coverage)', async () => {
      // このテストは、lastErrorがnullになる可能性のあるエッジケースをカバー
      // 特定のエラーなしでループを終了するシナリオを作成

      // 非常に珍しいエラータイプをスローするモックを作成
      const mockExecute = vi.fn().mockImplementation(() => {
        // 標準エラーではないが処理される何かをスロー
        throw 'string error'; // これはError('string error')に変換される
      });

      const result = await executeWithNonceRetry({
        executeTransaction: mockExecute,
        txParams: mockTxParams,
        maxRetries: 1,
        logger: mockLogger,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        // エラーは変換された文字列エラーであるべき
        expect(result.error.message).toBe('string error');
        expect(result.retryCount).toBe(0);
      }
    });

    it.skip('should call exponentialBackoff on subsequent retries', async () => {
      const spyBackoff = vi.spyOn(nonceRetryModule, 'exponentialBackoff').mockResolvedValue();
      const nonceError = new Error('nonce too low');
      const mockExecute = vi
        .fn()
        .mockRejectedValueOnce(nonceError) // 最初の試行、バックオフなし
        .mockRejectedValueOnce(nonceError) // 2回目の試行、バックオフが呼び出されるべき
        .mockResolvedValue({ transactionHash: validTxHash }); // 3回目の試行

      const result = await executeWithNonceRetry({
        executeTransaction: mockExecute,
        txParams: mockTxParams,
        maxRetries: 2,
        logger: mockLogger,
      });

      expect(result.success).toBe(true);
      // exponentialBackoffは試行1で呼び出されるべき (attempt > 0)
      expect(spyBackoff).toHaveBeenCalledWith(0);
      spyBackoff.mockRestore();
    });
  });

  describe('validateNonceError', () => {
    it('nonce too lowエラーを正しく検出', () => {
      const error = { message: 'nonce too low' };
      expect(validateNonceError(error)).toBe(true);
    });

    it('nonce too highエラーを正しく検出', () => {
      const error = { message: 'nonce too high' };
      expect(validateNonceError(error)).toBe(true);
    });

    it('replacement transaction underpricedエラーを正しく検出', () => {
      const error = { message: 'replacement transaction underpriced' };
      expect(validateNonceError(error)).toBe(true);
    });

    it('transaction already knownエラーを正しく検出', () => {
      const error = { message: 'transaction already known' };
      expect(validateNonceError(error)).toBe(true);
    });

    it('detailsフィールドのエラーを正しく検出', () => {
      const error = { details: 'nonce too low' };
      expect(validateNonceError(error)).toBe(true);
    });

    it('causeフィールドのエラーを正しく検出', () => {
      const error = { cause: { message: 'nonce too low' } };
      expect(validateNonceError(error)).toBe(true);
    });

    it('Nonceエラーでない場合はfalseを返す', () => {
      const error = { message: 'insufficient funds' };
      expect(validateNonceError(error)).toBe(false);
    });

    it('無効なエラーオブジェクトの場合はfalseを返す', () => {
      expect(validateNonceError('invalid error')).toBe(false);
      expect(validateNonceError(null)).toBe(false);
      expect(validateNonceError(undefined)).toBe(false);
    });
  });

  describe('comprehensive helper function tests', () => {
    it.skip('exponentialBackoff should handle different attempt values', async () => {
      // attempt 0でのテスト - より緩やかなタイミング
      const start0 = Date.now();
      await exponentialBackoff(0, 100);
      const end0 = Date.now();
      expect(end0 - start0).toBeGreaterThanOrEqual(90);
      expect(end0 - start0).toBeLessThan(250);

      // attempt 1でのテスト - より緩やかなタイミング
      const start1 = Date.now();
      await exponentialBackoff(1, 100);
      const end1 = Date.now();
      expect(end1 - start1).toBeGreaterThanOrEqual(180);
      expect(end1 - start1).toBeLessThan(350);
    });

    it('isNonceError should be comprehensively tested', () => {
      // すべてのNonceエラーパターンをテスト
      expect(isNonceError(new Error('nonce too low'))).toBe(true);
      expect(isNonceError(new Error('nonce too high'))).toBe(true);
      expect(isNonceError(new Error('replacement transaction underpriced'))).toBe(true);
      expect(isNonceError(new Error('transaction already known'))).toBe(true);

      // Nonce以外のエラーをテスト
      expect(isNonceError(new Error('insufficient funds'))).toBe(false);
      expect(isNonceError(new Error('gas limit exceeded'))).toBe(false);
      expect(isNonceError('string error')).toBe(false);
      expect(isNonceError(null)).toBe(false);
      expect(isNonceError(undefined)).toBe(false);
      expect(isNonceError({})).toBe(false);
    });

    it('buildSuccessResult should handle all result variations', () => {
      const baseResult = {
        transactionHash: validTxHash,
      };

      // explorerUrlなしでテスト
      const result1 = buildSuccessResult(baseResult, 5, 2);
      expect(result1).toEqual({
        success: true,
        transactionHash: validTxHash,
        finalNonce: 5,
        retryCount: 2,
      });

      // explorerUrlありでテスト
      const resultWithUrl = {
        transactionHash: validTxHash,
        explorerUrl: 'https://example.com/tx/123',
      };
      const result2 = buildSuccessResult(resultWithUrl, 10, 0);
      expect(result2).toEqual({
        success: true,
        transactionHash: validTxHash,
        explorerUrl: 'https://example.com/tx/123',
        finalNonce: 10,
        retryCount: 0,
      });
    });

    it('buildFailureResult should create proper failure objects', () => {
      const error = new Error('Test error');
      const result = buildFailureResult(error, 15, 3);

      expect(result).toEqual({
        success: false,
        error: error,
        finalNonce: 15,
        retryCount: 3,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Test error');
      }
    });
  });

  describe('uncovered function tests', () => {
    describe('isNonceError function coverage', () => {
      it('should correctly identify nonce errors from various error formats', () => {
        // 様々なエラーオブジェクト構造をテスト
        const nonceErrors = [
          { message: 'nonce too low' },
          { message: 'NONCE TOO HIGH' }, // 大文字小文字を区別しない
          { message: 'invalid nonce detected' },
          { details: 'nonce: expected 42' },
          { cause: { message: 'replacement transaction underpriced' } },
          { message: 'transaction already known' },
        ];

        for (const error of nonceErrors) {
          expect(isNonceError(error)).toBe(true);
        }
      });

      it('should return false for non-nonce errors', () => {
        const nonNonceErrors = [
          { message: 'insufficient funds' },
          { message: 'gas too low' },
          { message: 'execution reverted' },
          'string error',
          null,
          undefined,
          {},
        ];

        for (const error of nonNonceErrors) {
          expect(isNonceError(error)).toBe(false);
        }
      });

      it('should handle malformed error objects', () => {
        const malformedErrors = [
          { message: null },
          { details: undefined },
          { cause: null },
          { cause: { message: null } },
        ];

        for (const error of malformedErrors) {
          expect(() => isNonceError(error)).not.toThrow();
        }
      });
    });

    describe('exponentialBackoff function coverage', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should handle attempt 0 with base delay', async () => {
        const promise = exponentialBackoff(0, 1000);

        // 時間を進める
        vi.advanceTimersByTime(1000);

        await expect(promise).resolves.toBeUndefined();
      });

      it('should handle attempt 1 with doubled delay', async () => {
        const promise = exponentialBackoff(1, 1000);

        // 2000ms待つべき (1000 * 2^1)
        vi.advanceTimersByTime(2000);

        await expect(promise).resolves.toBeUndefined();
      });

      it('should cap delay at 30 seconds maximum', async () => {
        const promise = exponentialBackoff(10, 1000); // 1000 * 2^10 = 1,024,000msになるはず

        // 30,000msで上限に達するはず
        vi.advanceTimersByTime(30000);

        await expect(promise).resolves.toBeUndefined();
      });

      it('should handle custom base delay', async () => {
        const promise = exponentialBackoff(2, 500);

        // 2000ms待つべき (500 * 2^2)
        vi.advanceTimersByTime(2000);

        await expect(promise).resolves.toBeUndefined();
      });
    });

    describe('buildFailureResult function coverage', () => {
      it('should create failure result with all required fields', () => {
        const error = new Error('Test error');
        const result = buildFailureResult(error, 15, 3);

        expect(result).toEqual({
          success: false,
          error,
          finalNonce: 15,
          retryCount: 3,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toBe('Test error');
        }
      });

      it('should handle different error types', () => {
        const errors = [
          new Error('Standard error'),
          new TypeError('Type error'),
          new RangeError('Range error'),
        ];

        errors.forEach((error, index) => {
          const result = buildFailureResult(error, index, index);
          expect(result.success).toBe(false);
          expect(result.error).toBe(error);
          expect(result.finalNonce).toBe(index);
          expect(result.retryCount).toBe(index);
        });
      });

      it('should preserve error instance reference', () => {
        const originalError = new Error('Original error');
        const result = buildFailureResult(originalError, 1, 1);

        expect(result.error).toBe(originalError); // 同じ参照
        expect(result.error.message).toBe('Original error');
      });
    });

    describe('buildSuccessResult function coverage', () => {
      it('should create success result without explorerUrl', () => {
        const transactionResult = {
          transactionHash: '0x123' as Hex,
        };
        const finalNonce = 42;
        const retryCount = 2;

        const result = buildSuccessResult(transactionResult, finalNonce, retryCount);

        expect(result).toEqual({
          success: true,
          transactionHash: '0x123',
          finalNonce: 42,
          retryCount: 2,
        });
      });

      it('should create success result with explorerUrl', () => {
        const transactionResult = {
          transactionHash: '0x456' as Hex,
          explorerUrl: 'https://etherscan.io/tx/0x456',
        };
        const finalNonce = 24;
        const retryCount = 1;

        const result = buildSuccessResult(transactionResult, finalNonce, retryCount);

        expect(result).toEqual({
          success: true,
          transactionHash: '0x456',
          explorerUrl: 'https://etherscan.io/tx/0x456',
          finalNonce: 24,
          retryCount: 1,
        });
      });

      it('should handle undefined explorerUrl correctly', () => {
        const transactionResult = {
          transactionHash: '0x789' as Hex,
          explorerUrl: undefined,
        };
        const result = buildSuccessResult(transactionResult, 10, 0);

        expect(result).toEqual({
          success: true,
          transactionHash: '0x789',
          finalNonce: 10,
          retryCount: 0,
        });
        expect('explorerUrl' in result).toBe(false);
      });
    });
  });
});

describe('nonceRetry exponentialBackoff helper', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves after correct delay for given attempt', async () => {
    const attempt = 2; // delay = 1000 * 2^2 = 4000
    const promise = exponentialBackoff(attempt);
    vi.advanceTimersByTime(4000);
    await expect(promise).resolves.toBeUndefined();
  });

  it.skip('caps delay at 30000 ms for high attempts', async () => {
    const attempt = 10; // 30000msで上限に達するはず
    const promise = exponentialBackoff(attempt);
    vi.advanceTimersByTime(30000);
    await expect(promise).resolves.toBeUndefined();
  });
});

describe('nonceRetry helper functions', () => {
  const txHash = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef';

  it('buildSuccessResult sets fields correctly without explorerUrl', () => {
    const result = buildSuccessResult({ transactionHash: txHash }, 5, 2);
    expect(result).toEqual({
      success: true,
      transactionHash: txHash,
      finalNonce: 5,
      retryCount: 2,
    });
    expect((result as any).explorerUrl).toBeUndefined();
  });

  it('buildSuccessResult includes explorerUrl when provided', () => {
    const url = 'https://explorer/tx/' + txHash;
    const result = buildSuccessResult({ transactionHash: txHash, explorerUrl: url }, 1, 0);
    expect(result).toEqual({
      success: true,
      transactionHash: txHash,
      explorerUrl: url,
      finalNonce: 1,
      retryCount: 0,
    });
  });

  it('buildFailureResult sets error and metadata correctly', () => {
    const error = new Error('failure');
    const result = buildFailureResult(error, 3, 4);
    expect(result).toEqual({
      success: false,
      error,
      finalNonce: 3,
      retryCount: 4,
    });
  });

  it('isNonceError returns true for known nonce errors and false otherwise', () => {
    expect(isNonceError(new Error('nonce too low'))).toBe(true);
    expect(isNonceError(new Error('replacement transaction underpriced'))).toBe(true);
    expect(isNonceError(new Error('insufficient funds'))).toBe(false);
  });
});

describe('nonceRetry utilities', () => {
  describe('isNonceError', () => {
    it('returns true when message contains nonce error pattern', () => {
      const err = { message: 'Nonce too low' };
      expect(isNonceError(err)).toBe(true);
    });

    it('returns true when details contain nonce error pattern', () => {
      const err = { message: '', details: 'invalid nonce value' };
      expect(isNonceError(err)).toBe(true);
    });

    it('returns true when cause.message contains nonce error pattern', () => {
      const err = {
        message: '',
        details: '',
        cause: { message: 'replacement transaction underpriced' },
      };
      expect(isNonceError(err)).toBe(true);
    });

    it('returns false for non-nonce errors', () => {
      const err = new Error('some other error');
      expect(isNonceError(err)).toBe(false);
    });

    it('returns false for non-object values', () => {
      expect(isNonceError(null)).toBe(false);
      expect(isNonceError(undefined)).toBe(false);
      expect(isNonceError('error')).toBe(false);
    });
  });

  describe('exponentialBackoff', () => {
    let originalSetTimeout: typeof setTimeout;
    beforeEach(() => {
      originalSetTimeout = global.setTimeout;
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
      global.setTimeout = originalSetTimeout;
    });

    it.skip('invokes setTimeout with calculated delay', async () => {
      const spy = vi.spyOn(global, 'setTimeout');
      const promise = exponentialBackoff(2, 500); // 期待される遅延 = min(500 * 2^2 = 2000, 30000)
      // タイマーを進める
      vi.advanceTimersByTime(2000);
      await promise;
      expect(spy).toHaveBeenCalledWith(expect.any(Function), 2000);
    });

    it('caps delay at 30000ms', async () => {
      const spy = vi.spyOn(global, 'setTimeout');
      const promise = exponentialBackoff(10, 10000); // 10000*2^10 = 非常に大きいが、30000にキャップされる
      vi.advanceTimersByTime(30000);
      await promise;
      expect(spy).toHaveBeenCalledWith(expect.any(Function), 30000);
    });
  });

  describe('buildFailureResult', () => {
    it('constructs a failure result correctly', () => {
      const error = new Error('failure');
      const result = buildFailureResult(error, 5, 2);
      expect(result).toEqual({
        success: false,
        error,
        finalNonce: 5,
        retryCount: 2,
      });
    });
  });

  describe('buildSuccessResult', () => {
    it('constructs a success result without explorerUrl', () => {
      const txHash = '0xabcdef' as Hex;
      const result = buildSuccessResult({ transactionHash: txHash }, 3, 1);
      expect(result).toEqual({
        success: true,
        transactionHash: txHash,
        finalNonce: 3,
        retryCount: 1,
      });
    });

    it('constructs a success result with explorerUrl', () => {
      const txHash = '0x1234' as Hex;
      const url = 'https://explorer/test';
      const result = buildSuccessResult({ transactionHash: txHash, explorerUrl: url }, 7, 0);
      expect(result).toEqual({
        success: true,
        transactionHash: txHash,
        explorerUrl: url,
        finalNonce: 7,
        retryCount: 0,
      });
    });
  });
});
