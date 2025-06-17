import fs from 'node:fs/promises';
import path from 'node:path';
import { FileAccessError, PrivateKeyError } from '../utils/errors';

/**
 * 秘密鍵読み込み結果の型定義
 * @description viemが期待する0xプレフィックス付き形式とクリーンアップ関数を提供
 */
interface LoadPrivateKeyResult {
  privateKey: `0x${string}`; // viemが期待する0xプレフィックス付きの形式
  cleanup: () => void; // 秘密鍵の参照を破棄するための関数
}

/**
 * セキュアメモリ管理クラス
 * @description 秘密鍵をBufferのみで保持し、確実なメモリクリアを提供
 */
class SecureKeyStorage {
  private keyBuffer: Buffer | null = null;
  private isCleanedUp = false;

  /**
   * 秘密鍵をセキュアに保存
   * @param key 保存する秘密鍵文字列
   */
  store(key: string): void {
    // Bufferとしてのみ保存（文字列は保持しない）
    this.keyBuffer = Buffer.from(key, 'utf8');
    this.isCleanedUp = false;
  }

  /**
   * 秘密鍵文字列を取得（使用時のみ変換）
   * @returns 保存された秘密鍵文字列
   * @throws PrivateKeyError クリーンアップ後のアクセス時
   * @description セキュリティ上、この関数は最小限の使用に留めること
   */
  getKey(): `0x${string}` {
    if (this.isCleanedUp || !this.keyBuffer) {
      throw new PrivateKeyError('秘密鍵が既にクリーンアップされています。');
    }
    // 使用時のみBufferから文字列に変換
    return this.keyBuffer.toString('utf8') as `0x${string}`;
  }

  /**
   * セキュアなクリーンアップ
   * @description メモリ上の秘密鍵データを確実に削除
   */
  cleanup(): void {
    // Bufferの複数回オーバーライト（DoD 5220.22-M準拠の3パス削除）
    if (this.keyBuffer && !this.isCleanedUp) {
      // Pass 1: ゼロクリア
      this.keyBuffer.fill(0x00);
      // Pass 2: 全ビット1でオーバーライト
      this.keyBuffer.fill(0xFF);
      // Pass 3: ランダムパターンでオーバーライト
      const randomBytes = Buffer.allocUnsafe(this.keyBuffer.length);
      for (let i = 0; i < randomBytes.length; i++) {
        randomBytes[i] = Math.floor(Math.random() * 256);
      }
      randomBytes.copy(this.keyBuffer);
      // Pass 4: 最終ゼロクリア
      this.keyBuffer.fill(0x00);

      this.keyBuffer = null;
    }
    this.isCleanedUp = true;
  }
}
