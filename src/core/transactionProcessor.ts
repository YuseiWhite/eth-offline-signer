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
  data(message: string): void;
}

/**
 * デフォルトロガー実装
 * @description 環境に応じた適切なログ出力
 */
export let loggerInstance: Logger = defaultLogger;

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
  logger.info(`ブロック番号: ${receipt.blockNumber}`.trim());
  logger.info(`ガス使用量: ${receipt.gasUsed}`.trim());
  if (retryResult.explorerUrl) {
    logger.info(`エクスプローラーURL: ${retryResult.explorerUrl}`.trim());
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
  logger.error(`レシート取得エラー（トランザクションは送信済み）: ${errorMessage}`.trim());
  if (retryResult.explorerUrl) {
    logger.error(`エクスプローラーURL: ${retryResult.explorerUrl}`.trim());
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
    logger.info('トランザクションのマイニング完了を待機中...'.trim());

    const chainConfig = getChainConfig(txParams.chainId);
    const publicClient = createPublicClient({
      chain: chainConfig,
      transport: http(rpcUrl),
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: retryResult.transactionHash,
      timeout: 600_000, // 10分のタイムアウト設定
      retryCount: 60,
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
 * @returns ブロードキャスト結果（トランザクションハッシュのみ）
 * @description Nonceリトライを含むブロードキャスト処理のみ
 */
async function handleBroadcast(
  privateKey: `0x${string}`,
  txParams: EIP1559TxParams,
  rpcUrl: string,
  maxRetries: number,
  logger: Logger
): Promise<
  NonceRetrySuccessResult | { success: false; error: Error; finalNonce: number; retryCount: number }
> {
  logger.info('トランザクションのブロードキャストを開始...'.trim());

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

  return retryResult;
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
    logger: userLogger = loggerInstance,
  } = validatedOptions;

  // 1. オフライン署名（必須処理）
  userLogger.info('トランザクションの署名を開始...'.trim());
  const signedTransaction = await signEIP1559TransactionOffline(
    privateKey as `0x${string}`,
    txParams
  );
  userLogger.info('署名完了'.trim());

  // 2. ブロードキャスト処理（オプション）
  if (!broadcast) {
    userLogger.info('オフライン署名のみ完了しました。ブロードキャストはスキップされます。'.trim());
    return { signedTransaction };
  }

  // 3. ブロードキャスト実行
  const broadcastResult = await handleBroadcast(
    privateKey as `0x${string}`,
    txParams,
    rpcUrl,
    maxRetries,
    userLogger
  );

  if (!broadcastResult.success) {
    return {
      signedTransaction,
      broadcast: {
        broadcastCompleted: false,
        status: 'FAILED',
        finalNonce: broadcastResult.finalNonce,
        retryCount: broadcastResult.retryCount,
        error: broadcastResult.error.message,
      },
    };
  }

  // 4. トランザクションレシート取得
  const receiptResult = await handleTransactionReceipt(
    broadcastResult,
    txParams,
    rpcUrl,
    userLogger
  );

  return {
    signedTransaction,
    broadcast: receiptResult,
  };
}

// test-only exports
export {
  logTransactionSuccess,
  logTransactionError,
  getChainConfig,
  createSuccessBroadcastResult,
  createErrorBroadcastResult,
  handleTransactionReceipt,
  handleBroadcast,
};
