// biome-disable-file lint/suspicious/noExplicitAny
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  handleCliError,
  EthOfflineSignerError,
  PrivateKeyError,
  FileAccessError,
  SigningError,
  NetworkError,
  BroadcastError,
  MissingNonceError,
  NonceTooHighError,
  NonceTooLowError,
  TransactionReplacementError,
} from '../../../src/utils/errors';

// テスト環境の設定
process.env.NODE_ENV = 'test';

describe('errors', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('handleCliError', () => {
    describe('Error instances', () => {
      it('should handle EthOfflineSignerError', () => {
        const error = new EthOfflineSignerError('テストエラー');

        expect(() => handleCliError(error)).toThrow('process.exit called');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error: テストエラー');
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });

      it('should handle NetworkError', () => {
        const error = new NetworkError('ネットワークエラー');

        expect(() => handleCliError(error)).toThrow('process.exit called');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error: ネットワークエラー');
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });

      it('should handle generic Error', () => {
        const error = new Error('一般的なエラー');

        expect(() => handleCliError(error)).toThrow('process.exit called');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error: An unexpected error occurred: 一般的なエラー'
        );
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });
    });

    describe('Non-Error instances', () => {
      it('should handle string error', () => {
        const error = '文字列エラー';

        expect(() => handleCliError(error)).toThrow('process.exit called');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error: 文字列エラー');
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });

      it('should handle null error', () => {
        const error = null;

        expect(() => handleCliError(error)).toThrow('process.exit called');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error: An unknown error occurred.');
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });

      it('should handle undefined error', () => {
        const error = undefined;

        expect(() => handleCliError(error)).toThrow('process.exit called');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error: An unknown error occurred.');
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });

      it('should not exit when exit flag is false', () => {
        const error = new Error('no exit');
        handleCliError(error, false);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error: An unexpected error occurred: no exit'
        );
        expect(processExitSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('Custom Error Classes', () => {
    describe('EthOfflineSignerError', () => {
      it('should create error with message', () => {
        const error = new EthOfflineSignerError('テストメッセージ');
        expect(error.name).toBe('EthOfflineSignerError');
        expect(error.message).toBe('テストメッセージ');
      });
    });

    describe('NetworkError', () => {
      it('should create NetworkError with message', () => {
        const error = new NetworkError('ネットワークエラー');
        expect(error.name).toBe('NetworkError');
        expect(error.message).toBe('ネットワークエラー');
      });
    });

    describe('PrivateKeyError', () => {
      it('should create PrivateKeyError with message', () => {
        const error = new PrivateKeyError('秘密鍵エラー');
        expect(error.name).toBe('PrivateKeyError');
        expect(error.message).toBe('秘密鍵エラー');
      });
    });

    describe('FileAccessError', () => {
      it('should create FileAccessError with message', () => {
        const error = new FileAccessError('ファイルアクセスエラー');
        expect(error.name).toBe('FileAccessError');
        expect(error.message).toBe('ファイルアクセスエラー');
      });
    });

    describe('SigningError', () => {
      it('should create SigningError with message', () => {
        const error = new SigningError('署名エラー');
        expect(error.name).toBe('SigningError');
        expect(error.message).toBe('署名エラー');
      });
    });

    describe('BroadcastError', () => {
      it('should create BroadcastError with message', () => {
        const error = new BroadcastError('ブロードキャストエラー');
        expect(error.name).toBe('BroadcastError');
        expect(error.message).toBe('ブロードキャストエラー');
      });
    });

    describe('Nonce Errors', () => {
      it('should create MissingNonceError', () => {
        const error = new MissingNonceError();
        expect(error.name).toBe('MissingNonceError');
        expect(error.message).toBe(
          'Transaction nonce is undefined. Nonce must be explicitly provided for offline signing.'
        );
      });

      it('should create NonceTooHighError', () => {
        const error = new NonceTooHighError('Nonce高すぎエラー');
        expect(error.name).toBe('NonceTooHighError');
        expect(error.message).toBe('Nonce高すぎエラー');
      });

      it('should create NonceTooLowError', () => {
        const error = new NonceTooLowError('Nonce低すぎエラー', 5);
        expect(error.name).toBe('NonceTooLowError');
        expect(error.message).toBe('Nonce低すぎエラー');
        expect(error.recommendedNonce).toBe(5);
      });

      it('should create TransactionReplacementError', () => {
        const error = new TransactionReplacementError('トランザクション置換エラー', '0x123');
        expect(error.name).toBe('TransactionReplacementError');
        expect(error.message).toBe('トランザクション置換エラー');
        expect(error.replacementHash).toBe('0x123');
      });
    });
  });

  describe('EthOfflineSignerError stack trace behavior', () => {
    it('has stack property when captureStackTrace exists', () => {
      const err = new EthOfflineSignerError('msg');
      expect(err).toBeInstanceOf(Error);
      expect(typeof err.stack).toBe('string');
    });

    it('constructs without error when captureStackTrace is undefined', () => {
      const orig = Error.captureStackTrace;
      // @ts-ignore remove captureStackTrace
      Error.captureStackTrace = undefined;
      const err = new EthOfflineSignerError('msg2');
      expect(err.message).toBe('msg2');
      expect(err).toBeInstanceOf(Error);
      // restore
      // @ts-ignore restore captureStackTrace
      Error.captureStackTrace = orig;
    });
  });
});
