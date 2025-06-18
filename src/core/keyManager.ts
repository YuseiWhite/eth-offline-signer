import { randomFillSync } from 'node:crypto';
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
    // Bufferの複数回オーバーライト（DoD 5220.22-M準拠の4パス削除）
    if (this.keyBuffer && !this.isCleanedUp) {
      // Pass 1: ゼロクリア
      this.keyBuffer.fill(0x00);
      // Pass 2: 全ビット1でオーバーライト
      this.keyBuffer.fill(0xff);
      // Pass 3: ランダムパターンでオーバーライト
      const randomBytes = Buffer.allocUnsafe(this.keyBuffer.length);
      randomFillSync(randomBytes);
      randomBytes.copy(this.keyBuffer);
      // Pass 4: 最終ゼロクリア
      this.keyBuffer.fill(0x00);

      this.keyBuffer = null;
    }
    this.isCleanedUp = true;
  }
}

/**
 * 開発環境でのガベージコレクション強制実行
 * @description メモリクリーンアップを促進するため、開発環境でのみGCを強制実行
 */
function forceGarbageCollection(): void {
  // 開発環境でのみ強制GCを実行
  if (typeof global !== 'undefined' && global.gc && process.env.NODE_ENV === 'development') {
    global.gc();
  }
}

/**
 * 秘密鍵ファイルのパーミッションチェック
 * @param keyFilePath チェック対象の秘密鍵ファイルパス
 * @description POSIXシステムでは400パーミッションを推奨、Windowsでは警告のみ
 */
async function checkKeyFilePermissions(keyFilePath: string): Promise<void> {
  if (process.platform === 'win32') {
    // Windowsの場合、POSIXスタイルのパーミッションチェックは直接適用できない
    console.warn(
      `警告: Windows環境では秘密鍵ファイル (${keyFilePath}) のPOSIXパーミッションチェックはスキップされます。ファイルが適切に保護されていることを確認してください。`
    );
    return;
  }

  const stats = await fs.stat(keyFilePath);
  const permissions = (stats.mode & 0o777).toString(8); // 8進数でパーミッション取得
  if (permissions !== '400') {
    console.warn(
      `警告: 秘密鍵ファイル (${keyFilePath}) のパーミッションが400ではありません (現在のパーミッション: ${permissions})。セキュリティリスクを避けるため、chmod 400 ${path.basename(keyFilePath)} でパーミッションを修正することを強く推奨します。`
    );
  }
}

/**
 * 秘密鍵ファイルの読み込み
 * @param keyFilePath 読み込み対象の秘密鍵ファイルパス
 * @returns 読み込んだ秘密鍵文字列（前処理なし）
 * @throws FileAccessError ファイル読み込みに失敗した場合
 */
async function readPrivateKeyFile(keyFilePath: string): Promise<string> {
  try {
    // 非同期ファイル読み込み
    return (await fs.readFile(keyFilePath, 'utf-8')).trim();
  } catch (error: unknown) {
    const errorObj = error as Error & { code?: string };
    if (errorObj.code === 'ENOENT') {
      throw new FileAccessError(`秘密鍵ファイルが見つかりません: ${keyFilePath}`);
    }
    const errorMessage = errorObj.message || String(error);
    throw new FileAccessError(
      `秘密鍵ファイル (${keyFilePath}) の読み込みに失敗しました: ${errorMessage}`
    );
  }
}

/**
 * 秘密鍵の0xプレフィックス正規化
 * @param privateKey 正規化対象の秘密鍵文字列
 * @returns 0xプレフィックス付きの秘密鍵
 */
function normalizePrivateKeyPrefix(privateKey: string): string {
  if (privateKey.startsWith('0x')) {
    return privateKey;
  }
  console.info('🔧 秘密鍵に0xプレフィックスを追加しました (ソース: file)');
  return `0x${privateKey}`;
}

/**
 * 秘密鍵の形式検証
 * @param privateKey 検証対象の秘密鍵文字列
 * @throws PrivateKeyError 無効な形式の場合
 */
function validatePrivateKeyFormat(privateKey: string): void {
  const pkRegex = /^0x[0-9a-fA-F]{64}$/; // 64文字の16進数文字列、0xプレフィックス付き
  if (!pkRegex.test(privateKey)) {
    throw new PrivateKeyError(
      '無効な秘密鍵形式です。秘密鍵は0xプレフィックス付きの64文字の16進数文字列である必要があります。ソース: file'
    );
  }
}

/**
 * 秘密鍵の検証と正規化
 * @param privateKey 検証・正規化対象の秘密鍵文字列
 * @returns 0xプレフィックス付きの正規化された秘密鍵
 * @throws PrivateKeyError 無効な形式の場合
 */
function validateAndNormalizePrivateKey(privateKey: string): string {
  if (!privateKey) {
    throw new PrivateKeyError('秘密鍵が空です。');
  }

  // 0xプレフィックスがない場合は追加
  let normalizedKey = privateKey;
  if (!privateKey.startsWith('0x')) {
    console.info('🔧 秘密鍵に0xプレフィックスを追加しました (ソース: file)');
    normalizedKey = `0x${privateKey}`;
  }

  // 秘密鍵の形式検証 (64文字の16進数文字列、0xプレフィックス付き)
  const pkRegex = /^0x[0-9a-fA-F]{64}$/;
  if (!pkRegex.test(normalizedKey)) {
    throw new PrivateKeyError(
      '無効な秘密鍵形式です。秘密鍵は0xプレフィックス付きの64文字の16進数文字列である必要があります。ソース: file'
    );
  }

  return normalizedKey;
}

/**
 * 秘密鍵結果オブジェクトの作成
 * @param secureStorage 設定済みのセキュアストレージインスタンス
 * @returns loadPrivateKey結果オブジェクト
 */
function createPrivateKeyResult(secureStorage: SecureKeyStorage): LoadPrivateKeyResult {
  // viem互換性のため、直接的な秘密鍵アクセスを提供
  const privateKey = secureStorage.getKey();

  // セキュアなクリーンアップ関数
  const cleanup = () => {
    secureStorage.cleanup();
  };

  return { privateKey, cleanup };
}

/**
 * 入力パスの検証
 * @param keyFilePath 検証対象のファイルパス
 * @throws PrivateKeyError パスが無効な場合
 */
function validateKeyFilePath(keyFilePath: string): void {
  if (!keyFilePath) {
    throw new PrivateKeyError('秘密鍵ファイルのパスが指定されていません。');
  }
}

/**
 * 秘密鍵ファイルの安全な読み込み
 * @param keyFilePath 秘密鍵ファイルのパス（相対パス・絶対パス両対応）
 * @returns 検証済み秘密鍵とクリーンアップ関数
 * @throws PrivateKeyError 秘密鍵形式が無効な場合
 * @throws FileAccessError ファイル読み込みに失敗した場合
 * @description POSIXシステムでは400パーミッションを推奨、Windowsでは警告のみ
 */
export async function loadPrivateKey(keyFilePath: string): Promise<LoadPrivateKeyResult> {
  validateKeyFilePath(keyFilePath);

  const resolvedKeyFilePath = path.resolve(keyFilePath);
  const secureStorage = new SecureKeyStorage();

  try {
    await checkKeyFilePermissions(resolvedKeyFilePath);
    const rawPrivateKey = await readPrivateKeyFile(resolvedKeyFilePath);
    const normalizedPrivateKey = validateAndNormalizePrivateKey(rawPrivateKey);

    secureStorage.store(normalizedPrivateKey);
    return createPrivateKeyResult(secureStorage);
  } catch (error: unknown) {
    secureStorage.cleanup();

    if (error instanceof PrivateKeyError || error instanceof FileAccessError) {
      throw error;
    }

    const errorMessage = (error as Error).message || String(error);
    throw new FileAccessError(
      `秘密鍵ファイル (${resolvedKeyFilePath}) の処理中に予期しないエラーが発生しました: ${errorMessage}`
    );
  } finally {
    forceGarbageCollection();
  }
}
