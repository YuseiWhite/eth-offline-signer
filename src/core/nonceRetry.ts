/**
 * ロガーインターフェース
 * @description テスト可能性のための依存性注入パターン
 */
export interface Logger {
  info(message: string): void;
  error(message: string): void;
}

/**
 * デフォルトロガー実装
 * @description 本番環境でのconsole出力
 */
const DEFAULT_LOGGER: Logger = {
  info: (message: string) => console.info(message),
  error: (message: string) => console.error(message),
};

/**
 * Nonceリトライ処理のオプション設定
 * @description 外部関数に署名・ブロードキャストを委譲し、Nonceエラーのみを処理
 */
export interface NonceRetryOptions {
  /** 最大リトライ回数 (1-10の範囲) */
  readonly maxRetries: number;
  /** トランザクション実行関数 */
  readonly executeTransaction: (
    nonce: number
  ) => Promise<{ transactionHash: Hex; explorerUrl?: string }>;
  /** トランザクションパラメータ */
  readonly txParams: EIP1559TxParams;
  /** ロガー (オプション) */
  readonly logger?: Logger;
}

/**
 * Nonceリトライ処理の実行結果
 * @description 成功・失敗の詳細情報とリトライ統計を含む
 */
export interface NonceRetryResult {
  readonly success: boolean;
  readonly transactionHash?: Hex;
  readonly explorerUrl?: string;
  readonly finalNonce: number;
  readonly retryCount: number;
  readonly error?: Error;
}
