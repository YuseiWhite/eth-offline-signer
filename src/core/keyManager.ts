import { stat, readFile } from 'node:fs/promises';
import { FilePathSchema, PrivateKeyFormatSchema, RawPrivateKeySchema } from '../types/schema';
import { FileAccessError, PrivateKeyError } from '../utils/errors';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

/**
 * 秘密鍵ハンドルの型定義
 * @description 秘密鍵とクリーンアップ関数を含む安全な管理構造
 */
export interface PrivateKeyHandle {
  privateKey: `0x${string}`;
  cleanup?: () => void;
}

/**
 * ファイルアクセス権限の検証
 * @param filePath 検証対象のファイルパス
 * @throws FileAccessError ファイルが存在しない、または読み取り権限がない場合
 * @description セキュリティ強化：適切なファイルアクセス権限の確認
 */
async function validateFileAccess(filePath: string): Promise<void> {
  try {
    const stats = await stat(filePath);

    // Linux/macOS でのファイルパーミッション確認
    if (process.platform !== 'win32') {
      const mode = stats.mode & 0o777;
      const isSecure = mode === 0o400;

      if (!isSecure) {
        const currentPerm = mode.toString(8).padStart(3, '0');
        logger.warn(
          `秘密鍵ファイルのパーミッションが安全ではありません。` +
            `現在: ${currentPerm}, 推奨: 400。` +
            `\n   修正方法: chmod 400 ${filePath}`
        );
      }
    } else {
      // Windows環境での警告
      logger.warn(
        `Windows環境では、ファイルが適切に保護されていることを手動で確認してください: ${filePath}`
      );
    }
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === 'ENOENT') {
      throw new FileAccessError(`秘密鍵ファイルが見つかりません: ${filePath}`);
    }
    if (err.code === 'EACCES') {
      throw new FileAccessError(`秘密鍵ファイルの読み取り権限がありません: ${filePath}`);
    }
    throw new FileAccessError(`ファイルアクセスエラー: ${err.message || String(err)}`);
  }
}

/**
 * 秘密鍵の正規化処理
 * @param rawKey 生の秘密鍵（0xプレフィックスありまたはなし）
 * @returns 正規化された秘密鍵（0xプレフィックス付き）
 * @throws PrivateKeyError 無効な秘密鍵形式の場合
 * @description ドメイン層のスキーマを使用した検証と正規化
 */
function normalizePrivateKey(rawKey: string): `0x${string}` {
  // ドメイン層での生秘密鍵バリデーション
  const validatedRawKey = RawPrivateKeySchema.parse(rawKey.trim());

  // 0xプレフィックスの正規化
  const normalizedKey = validatedRawKey.startsWith('0x') ? validatedRawKey : `0x${validatedRawKey}`;

  // ドメイン層での正規化後バリデーション
  return PrivateKeyFormatSchema.parse(normalizedKey) as `0x${string}`;
}

/**
 * ファイルからの秘密鍵読み込み
 * @param keyFile 秘密鍵ファイルのパス
 * @returns 秘密鍵ハンドル
 * @throws FileAccessError ファイルアクセスエラーの場合
 * @throws PrivateKeyError 秘密鍵形式エラーの場合
 * @description ファイルI/Oとバリデーションを統合したビジネスロジック
 */
async function loadPrivateKeyFromFile(keyFile: string): Promise<PrivateKeyHandle> {
  // ファイルパス必須チェック（空文字、null、undefined含む）
  if (keyFile === undefined || keyFile === null || keyFile.trim() === '') {
    throw new PrivateKeyError('秘密鍵ファイルのパスが指定されていません。');
  }
  // ファイルパスバリデーション
  let validatedPath: string;
  try {
    validatedPath = FilePathSchema.parse(keyFile);
  } catch (error: unknown) {
    // 拡張子不一致などのZodErrorをPrivateKeyErrorとして扱う
    if (error instanceof ZodError) {
      const issue = error.issues?.[0]?.message || '無効なファイルパス形式です';
      throw new PrivateKeyError(issue);
    }
    throw error;
  }
  let rawContent: string;
  try {
    await validateFileAccess(validatedPath);
    rawContent = await readFile(validatedPath, 'utf-8');
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === 'ENOENT') {
      throw new FileAccessError(`秘密鍵ファイルが見つかりません: ${validatedPath}`);
    }
    throw new FileAccessError(
      `秘密鍵ファイルの読み込みに失敗しました: ${err.message || String(err)}`
    );
  }
  // 秘密鍵の正規化とバリデーション
  let normalizedKey: `0x${string}`;
  try {
    normalizedKey = normalizePrivateKey(rawContent);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const issue = error.issues?.[0]?.message || '';
      if (issue === '秘密鍵が空です') {
        throw new PrivateKeyError(`${issue}。`);
      }
      throw new PrivateKeyError(`無効な秘密鍵形式です。${issue}`);
    }
    throw new PrivateKeyError(`秘密鍵の形式が無効です。${(error as Error).message}`);
  }
  // クリーンアップ機能の提供
  let cleaned = false;
  const handle: PrivateKeyHandle = {
    get privateKey() {
      if (cleaned) {
        throw new PrivateKeyError('秘密鍵が既にクリーンアップされています。');
      }
      return normalizedKey;
    },
    cleanup() {
      cleaned = true;
    },
  };
  return handle;
}

/**
 * 秘密鍵の安全な読み込み
 * @param keyFile 秘密鍵ファイルのパス
 * @returns 秘密鍵ハンドル
 * @throws PrivateKeyError ファイルパスが指定されていない、または形式エラーの場合
 * @throws FileAccessError ファイルアクセスエラーの場合
 * @description 複数の秘密鍵取得方法を統合したワークフロー制御
 */
export async function loadPrivateKey(keyFile?: string): Promise<PrivateKeyHandle> {
  // ファイルパスの必須チェック（空文字、null、undefined含む）
  if (keyFile === undefined || keyFile === null || keyFile.trim() === '') {
    throw new PrivateKeyError('秘密鍵ファイルのパスが指定されていません。');
  }
  // 1. ファイルからの読み込み（優先）
  const handle = await loadPrivateKeyFromFile(keyFile);
  return handle;
}
