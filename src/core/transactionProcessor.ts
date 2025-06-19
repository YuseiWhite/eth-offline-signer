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
 * 入力パラメータのバリデーション
 * @param options トランザクション処理オプション
 * @throws Error バリデーション失敗時
 * @description 入力値の妥当性検証のみ
 */
function validateProcessorOptions(
  options: unknown
): asserts options is TransactionProcessorOptions {
  if (!options || typeof options !== 'object') {
    throw new Error('TransactionProcessorOptionsが指定されていません');
  }

  const opts = options as Partial<TransactionProcessorOptions>;

  if (!opts.privateKey || typeof opts.privateKey !== 'string') {
    throw new Error('privateKeyが指定されていません');
  }

  if (!opts.txParams || typeof opts.txParams !== 'object') {
    throw new Error('txParamsが指定されていません');
  }

  if (typeof opts.broadcast !== 'boolean') {
    throw new Error('broadcastはboolean値である必要があります');
  }

  if (opts.broadcast && (!opts.rpcUrl || typeof opts.rpcUrl !== 'string')) {
    throw new Error('ブロードキャスト時にはrpcUrlが必要です');
  }
}

/**
 * トランザクション情報の成功ログ出力
 * @param retryResult リトライ結果
 * @param receipt トランザクションレシート
 * @param logger ロガー
 * @description 成功時のトランザクション情報ログ出力のみ
 */
function logTransactionSuccess(
  retryResult: NonceRetryResult,
  receipt: { blockNumber: bigint; gasUsed: bigint },
  logger: Logger
): void {
  logger.info(`📋 トランザクションハッシュ: ${retryResult.transactionHash}`);
  logger.info(`⛏️  ブロック番号: ${receipt.blockNumber}`);
  logger.info(`⛽ ガス使用量: ${receipt.gasUsed}`);
  if (retryResult.explorerUrl) {
    logger.info(`🔗 エクスプローラーURL: ${retryResult.explorerUrl}`);
  }
}

/**
 * トランザクション情報のエラーログ出力
 * @param retryResult リトライ結果
 * @param errorMessage エラーメッセージ
 * @param logger ロガー
 * @description エラー時のトランザクション情報ログ出力のみ
 */
function logTransactionError(
  retryResult: NonceRetryResult,
  errorMessage: string,
  logger: Logger
): void {
  logger.info(`⚠️  レシート取得エラー（トランザクションは送信済み）: ${errorMessage}`);
  logger.info(`📋 トランザクションハッシュ: ${retryResult.transactionHash}`);
  if (retryResult.explorerUrl) {
    logger.info(`🔗 エクスプローラーURL: ${retryResult.explorerUrl}`);
  }
}