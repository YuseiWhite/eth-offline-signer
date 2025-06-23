import { readFileSync } from 'node:fs';
import { access, constants } from 'node:fs/promises';
import { FilePathSchema, PrivateKeyFormatSchema, RawPrivateKeySchema } from '../types/schema';
import { FileAccessError, PrivateKeyError } from '../utils/errors';

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
    await access(filePath, constants.F_OK | constants.R_OK);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new FileAccessError(`秘密鍵ファイルが見つかりません: ${filePath}`);
    }
    if ((error as NodeJS.ErrnoException).code === 'EACCES') {
      throw new FileAccessError(`秘密鍵ファイルの読み取り権限がありません: ${filePath}`);
    }
    throw new FileAccessError(`ファイルアクセスエラー: ${(error as Error).message}`);
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
  // ドメイン層でのファイルパスバリデーション
  const validatedPath = FilePathSchema.parse(keyFile);

  // ファイルアクセス権限の検証
  await validateFileAccess(validatedPath);

  try {
    const rawContent = readFileSync(validatedPath, 'utf-8');
    const privateKey = normalizePrivateKey(rawContent);

    return { privateKey };
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      throw new PrivateKeyError(`秘密鍵の形式が無効です: ${error.message}`);
    }
    throw new FileAccessError(
      `秘密鍵ファイルの読み込みに失敗しました: ${(error as Error).message}`
    );
  }
}

/**
 * 環境変数からの秘密鍵読み込み
 * @param envVarName 環境変数名
 * @returns 秘密鍵ハンドル
 * @throws PrivateKeyError 環境変数が存在しない、または無効な形式の場合
 * @description 環境変数の安全な取得とバリデーション
 */
function loadPrivateKeyFromEnv(envVarName: string): PrivateKeyHandle {
  const rawKey = process.env[envVarName];

  if (!rawKey) {
    throw new PrivateKeyError(`環境変数 ${envVarName} が設定されていません`);
  }

  try {
    const privateKey = normalizePrivateKey(rawKey);
    return { privateKey };
  } catch (error) {
    throw new PrivateKeyError(
      `環境変数 ${envVarName} の秘密鍵形式が無効です: ${(error as Error).message}`
    );
  }
}

/**
 * 秘密鍵の安全な読み込み
 * @param keyFile 秘密鍵ファイルのパス（オプション）
 * @param privateKeyEnv 秘密鍵環境変数名（オプション、デフォルト: 'PRIVATE_KEY'）
 * @returns 秘密鍵ハンドル
 * @throws PrivateKeyError どちらの方法でも秘密鍵を取得できない場合
 * @throws FileAccessError ファイルアクセスエラーの場合
 * @description 複数の秘密鍵取得方法を統合したワークフロー制御
 */
export async function loadPrivateKey(
  keyFile?: string,
  privateKeyEnv = 'PRIVATE_KEY'
): Promise<PrivateKeyHandle> {
  // 1. ファイルからの読み込み（優先）
  if (keyFile) {
    const handle = await loadPrivateKeyFromFile(keyFile);
    return handle;
  }

  // 2. 環境変数からの読み込み（フォールバック）
  try {
    const handle = loadPrivateKeyFromEnv(privateKeyEnv);
    return handle;
  } catch (error) {
    // 両方の方法で失敗した場合の包括的エラー
    if (!keyFile) {
      throw new PrivateKeyError(
        `秘密鍵を取得できませんでした。--key-fileオプションでファイルを指定するか、環境変数 ${privateKeyEnv} を設定してください。`
      );
    }

    // keyFileが指定されていた場合は、ファイル読み込みエラーが既に投げられているはず
    throw error;
  }
}
