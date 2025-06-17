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
