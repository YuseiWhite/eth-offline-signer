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

/**
 * Nonceエラーの検出パターン
 * @description セキュリティ上の理由でreadonlyで定義
 */
const NONCE_ERROR_PATTERNS = [
  'nonce too low',
  'nonce too high',
  'invalid nonce',
  'nonce.*expected',
] as const;

/**
 * 入力パラメータのバリデーション
 * @param options リトライオプション
 * @throws Error バリデーション失敗時
 * @description 入力値の妥当性検証のみ
 */
function validateNonceRetryOptions(options: unknown): asserts options is NonceRetryOptions {
  if (!options || typeof options !== 'object') {
    throw new Error('NonceRetryOptionsが指定されていません');
  }

  const opts = options as Partial<NonceRetryOptions>;

  if (
    typeof opts.maxRetries !== 'number' ||
    !Number.isInteger(opts.maxRetries) ||
    opts.maxRetries < 1 ||
    opts.maxRetries > 10
  ) {
    throw new Error('maxRetriesは1-10の整数である必要があります');
  }

  if (typeof opts.executeTransaction !== 'function') {
    throw new Error('executeTransactionは関数である必要があります');
  }

  if (!opts.txParams || typeof opts.txParams !== 'object') {
    throw new Error('txParamsが指定されていません');
  }

  if (
    typeof opts.txParams.nonce !== 'number' ||
    !Number.isInteger(opts.txParams.nonce) ||
    opts.txParams.nonce < 0
  ) {
    throw new Error('nonceは0以上の整数である必要があります');
  }
}

/**
 * エラーメッセージからNonceエラーかどうかを判定
 * @param error エラーオブジェクト
 * @returns Nonceエラーの場合true
 * @description Nonceエラーの判定のみ
 */
function isNonceError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const errorObj = error as Error & {
    details?: string;
    cause?: { message?: string };
  };

  const messagesToCheck = [
    errorObj.message || '',
    errorObj.details || '',
    errorObj.cause?.message || '',
  ];

  return NONCE_ERROR_PATTERNS.some((pattern) =>
    messagesToCheck.some((message) => new RegExp(pattern, 'i').test(message))
  );
}

/**
 * リトライログの出力
 * @param currentNonce 現在のNonce
 * @param retryCount リトライ回数
 * @param maxRetries 最大リトライ回数
 * @param errorMessage エラーメッセージ
 * @param logger ロガー
 * @description ログ出力のみ
 */
function logRetryAttempt(
  currentNonce: number,
  retryCount: number,
  maxRetries: number,
  errorMessage: string,
  logger: Logger
): void {
  logger.info(`⚠️  Nonceエラー検出: ${errorMessage}`);
  logger.info(
    `🔄 Nonce ${currentNonce} → ${currentNonce + 1} でリトライ (${retryCount + 1}/${maxRetries})`
  );
}

/**
 * 成功結果の構築
 * @param result トランザクション実行結果
 * @param finalNonce 最終Nonce
 * @param retryCount リトライ回数
 * @returns 成功結果オブジェクト
 * @description 成功結果の構築のみ
 */
function buildSuccessResult(
  result: { transactionHash: Hex; explorerUrl?: string },
  finalNonce: number,
  retryCount: number
): NonceRetryResult {
  const successResult: NonceRetryResult = {
    success: true,
    transactionHash: result.transactionHash,
    finalNonce,
    retryCount,
  };

  if (result.explorerUrl) {
    return { ...successResult, explorerUrl: result.explorerUrl };
  }

  return successResult;
}
