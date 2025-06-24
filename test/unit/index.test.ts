/**
 * src/index.ts エクスポート機能テスト
 * @description ライブラリのエントリーポイントのエクスポート機能を検証
 */

import { describe, it, expect } from 'vitest';

// すべてのエクスポートされた関数と型をインポート
import {
  loadPrivateKey,
  signEIP1559TransactionOffline,
  broadcastTransaction,
  getAllSupportedNetworks,
  processTransaction,
  validateEIP1559TxParams,
  EthOfflineSignerError,
  InvalidInputError,
  PrivateKeyError,
  FileAccessError,
  SigningError,
  MissingNonceError,
  BroadcastError,
  NetworkError,
} from '../../src/index';

// 型のインポートテスト
import type { EIP1559TxParams } from '../../src/index';

describe('src/index.ts エクスポート機能', () => {
  describe('関数エクスポート', () => {
    it('loadPrivateKey関数がエクスポートされている', () => {
      expect(typeof loadPrivateKey).toBe('function');
    });

    it('signEIP1559TransactionOffline関数がエクスポートされている', () => {
      expect(typeof signEIP1559TransactionOffline).toBe('function');
    });

    it('broadcastTransaction関数がエクスポートされている', () => {
      expect(typeof broadcastTransaction).toBe('function');
    });

    it('getAllSupportedNetworks関数がエクスポートされている', () => {
      expect(typeof getAllSupportedNetworks).toBe('function');
    });

    it('processTransaction関数がエクスポートされている', () => {
      expect(typeof processTransaction).toBe('function');
    });

    it('validateEIP1559TxParams関数がエクスポートされている', () => {
      expect(typeof validateEIP1559TxParams).toBe('function');
    });
  });

  describe('エラークラスエクスポート', () => {
    it('EthOfflineSignerErrorクラスがエクスポートされている', () => {
      expect(typeof EthOfflineSignerError).toBe('function');
      expect(EthOfflineSignerError.prototype).toBeInstanceOf(Error);
    });

    it('InvalidInputErrorクラスがエクスポートされている', () => {
      expect(typeof InvalidInputError).toBe('function');
      expect(InvalidInputError.prototype).toBeInstanceOf(Error);
    });

    it('PrivateKeyErrorクラスがエクスポートされている', () => {
      expect(typeof PrivateKeyError).toBe('function');
      expect(PrivateKeyError.prototype).toBeInstanceOf(Error);
    });

    it('FileAccessErrorクラスがエクスポートされている', () => {
      expect(typeof FileAccessError).toBe('function');
      expect(FileAccessError.prototype).toBeInstanceOf(Error);
    });

    it('SigningErrorクラスがエクスポートされている', () => {
      expect(typeof SigningError).toBe('function');
      expect(SigningError.prototype).toBeInstanceOf(Error);
    });

    it('MissingNonceErrorクラスがエクスポートされている', () => {
      expect(typeof MissingNonceError).toBe('function');
      expect(MissingNonceError.prototype).toBeInstanceOf(Error);
    });

    it('BroadcastErrorクラスがエクスポートされている', () => {
      expect(typeof BroadcastError).toBe('function');
      expect(BroadcastError.prototype).toBeInstanceOf(Error);
    });

    it('NetworkErrorクラスがエクスポートされている', () => {
      expect(typeof NetworkError).toBe('function');
      expect(NetworkError.prototype).toBeInstanceOf(Error);
    });
  });

  describe('型エクスポート', () => {
    it('EIP1559TxParams型が利用可能', () => {
      // 型チェックのため、型を使用した変数を定義
      const sampleParams: EIP1559TxParams = {
        to: '0x742d35Cc6634C0532925a3b8D186aA1F7c6D4cF1',
        value: '0',
        chainId: 1,
        nonce: 0,
        gasLimit: '21000',
        maxFeePerGas: '20000000000',
        maxPriorityFeePerGas: '1000000000',
      };

      // パラメータが適切に定義されていることを確認
      expect(sampleParams.to).toBe('0x742d35Cc6634C0532925a3b8D186aA1F7c6D4cF1');
      expect(sampleParams.chainId).toBe(1);
    });
  });

  describe('ライブラリ統合テスト', () => {
    it('エクスポートされた関数が実際に動作する（validateEIP1559TxParams）', () => {
      const validParams = {
        to: '0x742d35Cc6634C0532925a3b8D186aA1F7c6D4cF1',
        value: '0',
        chainId: 1,
        nonce: 0,
        gasLimit: '21000',
        maxFeePerGas: '20000000000',
        maxPriorityFeePerGas: '1000000000',
      };

      // バリデーション関数が正常に動作することを確認
      expect(() => validateEIP1559TxParams(validParams)).not.toThrow();
    });

    it('エクスポートされたエラークラスが正常にインスタンス化される', () => {
      const error = new InvalidInputError('テストエラー');
      expect(error).toBeInstanceOf(InvalidInputError);
      expect(error).toBeInstanceOf(EthOfflineSignerError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('テストエラー');
    });
  });
});
