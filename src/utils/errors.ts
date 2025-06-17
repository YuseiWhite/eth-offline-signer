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
