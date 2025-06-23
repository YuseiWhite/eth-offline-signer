import { ErrorObjectSchema, ErrorStringSchema } from '../types/schema';

/**
 * アプリケーション基底エラークラス
 * @description 全てのカスタムエラーの基底クラス、スタックトレース最適化を含む
 */
export class EthOfflineSignerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // エラーのスタックトレースからこのコンストラクタの呼び出しを除外する場合
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * 入力値検証エラー
 * @description Zodスキーマ検証失敗時に使用
 */
export class InvalidInputError extends EthOfflineSignerError {}

/**
 * 秘密鍵関連エラー
 * @description 秘密鍵の形式・読み込み・処理エラー時に使用
 */
export class PrivateKeyError extends EthOfflineSignerError {}

/**
 * ファイルアクセスエラー
 * @description ファイル読み込み・権限・存在確認エラー時に使用
 */
export class FileAccessError extends EthOfflineSignerError {}

/**
 * トランザクション署名エラー
 * @description viem署名処理・アカウント作成エラー時に使用
 */
export class SigningError extends EthOfflineSignerError {}

/**
 * ネットワーク接続エラー
 * @description RPC接続・チェーンID不正・ネットワーク障害時に使用
 */
export class NetworkError extends EthOfflineSignerError {}

/**
 * ブロードキャストエラー
 * @description トランザクション送信・確認失敗時に使用
 */
export class BroadcastError extends EthOfflineSignerError {}

/**
 * Nonce未設定エラー
 * @description オフライン署名でNonceが未定義の場合に使用
 */
export class MissingNonceError extends SigningError {
  constructor() {
    super('Transaction nonce is undefined. Nonce must be explicitly provided for offline signing.');
  }
}

/**
 * Nonce値過大エラー
 * @description 指定Nonceが現在のアカウントNonceより大きい場合に使用
 */
export class NonceTooHighError extends SigningError {}

/**
 * Nonce値過小エラー（推奨値付き）
 * @description 指定Nonceが使用済みで、推奨Nonce値を提供
 */
export class NonceTooLowError extends SigningError {
  public readonly recommendedNonce: number;

  constructor(message: string, recommendedNonce: number) {
    super(message);
    this.recommendedNonce = recommendedNonce;
  }
}

/**
 * トランザクション置換エラー（置換ハッシュ付き）
 * @description 同一Nonceの別トランザクションが存在する場合に使用
 */
export class TransactionReplacementError extends SigningError {
  public readonly replacementHash: string;

  constructor(message: string, replacementHash: string) {
    super(message);
    this.replacementHash = replacementHash;
  }
}

/**
 * CLI統合エラーハンドラー
 * @param error 処理対象のエラー（任意の型）
 * @param exit プロセス終了フラグ（デフォルト: true）
 * @description カスタムエラーは日本語メッセージ、その他は英語メッセージでコンソール出力
 */
export function handleCliError(error: unknown, exit = true): void {
  let errorMessage = 'An unknown error occurred.';

  if (error instanceof EthOfflineSignerError) {
    errorMessage = error.message;
  } else {
    // ドメイン層のスキーマを使用したエラーオブジェクト検証
    const errorResult = ErrorObjectSchema.safeParse(error);
    if (errorResult.success) {
      errorMessage = `An unexpected error occurred: ${errorResult.data.message}`;
    } else {
      // 文字列エラーの検証
      const stringResult = ErrorStringSchema.safeParse(error);
      if (stringResult.success) {
        errorMessage = stringResult.data;
      }
    }
  }

  console.error(`Error: ${errorMessage}`);

  if (exit) {
    process.exit(1);
  }
}
