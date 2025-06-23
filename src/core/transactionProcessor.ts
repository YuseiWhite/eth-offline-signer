import { createPublicClient, http } from 'viem';
import type { Hex } from 'viem';
import { broadcastTransaction } from './broadcaster';
import { executeWithNonceRetry, type NonceRetrySuccessResult } from './nonceRetry';
import { signEIP1559TransactionOffline } from './signer';
import { getNetworkConfig } from './networkConfig';
import {
  validateTransactionProcessorOptions,
  type TransactionProcessorOptions,
  type EIP1559TxParams,
} from '../types/schema';
import { logger as defaultLogger } from '../utils/logger';

/**
 * デフォルト設定値
 */
export const DEFAULT_MAX_RETRIES = 3;

/**
 * ロガーインターフェース
 * @description テスト可能性のための依存性注入パターン
 */
export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * デフォルトロガー実装
 * @description 環境に応じた適切なログ出力
 */
let loggerInstance: Logger = {
  info: (message: string) => defaultLogger.info(message),
  warn: (message: string) => defaultLogger.warn(message),
  error: (message: string) => defaultLogger.error(message),
};

export const logger: Logger = loggerInstance;

/**
 * ロガーインスタンスの設定（テスト環境用）
 * @param newLogger 新しいロガーインスタンス
 * @description テスト環境でのログ抑制やカスタムロガーの設定
 */
export function setLogger(newLogger: Logger): void {
  loggerInstance = newLogger;
}

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
    broadcastCompleted: boolean;
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
 * チェーンIDに基づく適切なチェーン設定の取得
 * @param chainId 対象チェーンID
 * @returns viemチェーン設定
 * @throws Error 未知のチェーンIDの場合
 * @description networkConfigから正しいチェーン設定を取得
 */
function getChainConfig(chainId: number) {
  const networkConfig = getNetworkConfig(chainId);
  return networkConfig.chain;
}

/**
 * トランザクション情報の成功ログ出力
 * @param retryResult リトライ結果（成功のみ）
 * @param receipt トランザクションレシート
 * @param logger ロガー
 * @description 成功時のトランザクション情報ログ出力のみ
 */
function logTransactionSuccess(
  retryResult: NonceRetrySuccessResult,
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
 * @param retryResult リトライ結果（成功のみ）
 * @param errorMessage エラーメッセージ
 * @param logger ロガー
 * @description エラー時のトランザクション情報ログ出力のみ
 */
function logTransactionError(
  retryResult: NonceRetrySuccessResult,
  errorMessage: string,
  logger: Logger
): void {
  logger.error(`⚠️  レシート取得エラー（トランザクションは送信済み）: ${errorMessage}`);
  logger.error(`📋 トランザクションハッシュ: ${retryResult.transactionHash}`);
  if (retryResult.explorerUrl) {
    logger.error(`🔗 エクスプローラーURL: ${retryResult.explorerUrl}`);
  }
}

/**
 * 成功時のブロードキャスト結果作成
 * @param retryResult リトライ結果（成功のみ）
 * @param receipt トランザクションレシート
 * @returns ブロードキャスト結果
 * @description 成功結果の作成のみ
 */
function createSuccessBroadcastResult(
  retryResult: NonceRetrySuccessResult,
  receipt: { blockNumber: bigint; gasUsed: bigint }
): NonNullable<TransactionProcessorResult['broadcast']> {
  const result: NonNullable<TransactionProcessorResult['broadcast']> = {
    broadcastCompleted: true,
    status: 'SUCCESS',
    transactionHash: retryResult.transactionHash,
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
 * エラー時のブロードキャスト結果作成
 * @param retryResult リトライ結果（成功のみ）
 * @param errorMessage エラーメッセージ
 * @returns ブロードキャスト結果
 * @description エラー結果の作成のみ
 */
function createErrorBroadcastResult(
  retryResult: NonceRetrySuccessResult,
  errorMessage: string
): NonNullable<TransactionProcessorResult['broadcast']> {
  const result: NonNullable<TransactionProcessorResult['broadcast']> = {
    broadcastCompleted: true,
    status: 'BROADCASTED_BUT_UNCONFIRMED',
    transactionHash: retryResult.transactionHash,
    finalNonce: retryResult.finalNonce,
    retryCount: retryResult.retryCount,
    error: `レシート取得エラー: ${errorMessage}`,
  };

  if (retryResult.explorerUrl) {
    result.explorerUrl = retryResult.explorerUrl;
  }

  return result;
}

/**
 * トランザクションレシートの取得と結果構築
 * @param retryResult Nonceリトライ処理の成功結果
 * @param txParams トランザクションパラメータ（チェーンID取得用）
 * @param rpcUrl レシート取得用RPCエンドポイント
 * @param logger ロガー
 * @returns ブロードキャスト結果（ブロック情報とガス使用量を含む）
 * @description waitForTransactionReceiptでマイニング完了を待機、エラー時もハッシュは表示
 */
async function handleTransactionReceipt(
  retryResult: NonceRetrySuccessResult,
  txParams: EIP1559TxParams,
  rpcUrl: string,
  logger: Logger
): Promise<NonNullable<TransactionProcessorResult['broadcast']>> {
  try {
    logger.info('⏳ トランザクションのマイニング完了を待機中...');

    const chainConfig = getChainConfig(txParams.chainId);
    const publicClient = createPublicClient({
      chain: chainConfig,
      transport: http(rpcUrl),
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: retryResult.transactionHash,
    });

    logTransactionSuccess(retryResult, receipt, logger);
    return createSuccessBroadcastResult(retryResult, receipt);
  } catch (receiptError: unknown) {
    const errorMessage =
      receiptError instanceof Error ? receiptError.message : String(receiptError);

    logTransactionError(retryResult, errorMessage, logger);
    return createErrorBroadcastResult(retryResult, errorMessage);
  }
}

/**
 * ブロードキャスト処理の実行
 * @param privateKey 署名用秘密鍵
 * @param txParams トランザクションパラメータ
 * @param rpcUrl ブロードキャスト先RPCエンドポイント
 * @param maxRetries 最大リトライ回数
 * @param logger ロガー
 * @returns ブロードキャスト結果（レシート情報を含む）
 * @description Nonceリトライとレシート取得を含む完全なブロードキャストフロー
 */
async function handleBroadcast(
  privateKey: `0x${string}`,
  txParams: EIP1559TxParams,
  rpcUrl: string,
  maxRetries: number,
  logger: Logger
): Promise<NonNullable<TransactionProcessorResult['broadcast']>> {
  logger.info('📡 トランザクションのブロードキャストを開始...');

  const executeTransaction = async (nonce: number) => {
    const updatedParams = { ...txParams, nonce };
    const signedTx = await signEIP1559TransactionOffline(privateKey, updatedParams);
    return await broadcastTransaction(signedTx, updatedParams.chainId, rpcUrl);
  };

  const retryResult = await executeWithNonceRetry({
    maxRetries,
    executeTransaction,
    txParams,
    logger,
  });

  if (!retryResult.success) {
    return {
      broadcastCompleted: false,
      status: 'FAILED',
      finalNonce: retryResult.finalNonce,
      retryCount: retryResult.retryCount,
      error: retryResult.error.message,
    };
  }

  return await handleTransactionReceipt(retryResult, txParams, rpcUrl, logger);
}

/**
 * トランザクションの包括的処理
 * @param options 処理オプション（秘密鍵、パラメータ、ブロードキャスト設定）
 * @returns 処理結果（署名済みトランザクションとブロードキャスト結果）
 * @throws Error バリデーションエラーまたは処理エラー
 * @description 署名のみまたは署名+ブロードキャストの完全なワークフロー制御
 */
export async function processTransaction(
  options: TransactionProcessorOptions
): Promise<TransactionProcessorResult> {
  // 常に本番環境の厳しいバリデーションを実行
  const validatedOptions = validateTransactionProcessorOptions(options);

  const {
    privateKey,
    txParams,
    broadcast,
    rpcUrl,
    maxRetries = DEFAULT_MAX_RETRIES,
    logger = DEFAULT_LOGGER,
  } = validatedOptions;

  // 1. オフライン署名（必須処理）
  logger.info('🔐 トランザクションの署名を開始...');
  const signedTransaction = await signEIP1559TransactionOffline(
    privateKey as `0x${string}`,
    txParams
  );
  logger.info(`✅ 署名完了: ${signedTransaction}`);

  // 2. ブロードキャスト処理（オプション）
  if (!broadcast) {
    logger.info('📝 オフライン署名のみ完了しました。ブロードキャストはスキップされます。');
    return { signedTransaction };
  }

  if (!rpcUrl) {
    throw new Error('ブロードキャスト時にはrpcUrlが必要です');
  }

  const broadcastResult = await handleBroadcast(
    privateKey as `0x${string}`,
    txParams,
    rpcUrl,
    maxRetries,
    logger
  );

  return {
    signedTransaction,
    broadcast: broadcastResult,
  };
}
