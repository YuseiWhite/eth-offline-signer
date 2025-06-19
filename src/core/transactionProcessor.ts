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
 * ブロードキャストステータス
 * @description ブロードキャスト処理の詳細な状態を表現
 */
export type BroadcastStatus = 'SUCCESS' | 'BROADCASTED_BUT_UNCONFIRMED' | 'FAILED';

/**
 * トランザクション処理結果
 * @description 署名済みトランザクションとブロードキャスト結果（実行時のみ）を含む
 */
export interface TransactionProcessorResult {
  signedTransaction: Hex;
  broadcast?: {
    success: boolean;
    status: BroadcastStatus;
    transactionHash?: Hex;
    explorerUrl?: string;
    blockNumber?: bigint;
    gasUsed?: bigint;
    finalNonce?: number;
    retryCount?: number;
    error?: string;
  };
}

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

/**
 * 成功時のブロードキャスト結果構築
 * @param retryResult リトライ結果
 * @param receipt トランザクションレシート
 * @returns ブロードキャスト結果
 * @description 成功結果の構築のみ
 */
function buildSuccessBroadcastResult(
  retryResult: NonceRetryResult,
  receipt: { blockNumber: bigint; gasUsed: bigint }
): NonNullable<TransactionProcessorResult['broadcast']> {
  const result: NonNullable<TransactionProcessorResult['broadcast']> = {
    success: true,
    status: 'SUCCESS',
    transactionHash: retryResult.transactionHash!,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    finalNonce: retryResult.finalNonce,
    retryCount: retryResult.retryCount,
  };

  if (retryResult.explorerUrl) {
    result.explorerUrl = retryResult.explorerUrl;
  }

  return result;
}

/**
 * エラー時のブロードキャスト結果構築
 * @param retryResult リトライ結果
 * @param errorMessage エラーメッセージ
 * @returns ブロードキャスト結果
 * @description エラー結果の構築のみ
 */
function buildErrorBroadcastResult(
  retryResult: NonceRetryResult,
  errorMessage: string
): NonNullable<TransactionProcessorResult['broadcast']> {
  const result: NonNullable<TransactionProcessorResult['broadcast']> = {
    success: true,
    status: 'BROADCASTED_BUT_UNCONFIRMED',
    transactionHash: retryResult.transactionHash!,
    finalNonce: retryResult.finalNonce,
    retryCount: retryResult.retryCount,
    error: `レシート取得エラー: ${errorMessage}`,
  };

  if (retryResult.explorerUrl) {
    result.explorerUrl = retryResult.explorerUrl;
  }

  return result;
}