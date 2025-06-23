import type { Hex } from 'viem';
import {
  validateNonceRetryOptions,
  validateNonceError,
  type NonceRetryOptions,
} from '../types/schema';
import { logger as defaultLogger } from '../utils/logger';

/**
 * ロガーインターフェース
 * @description テスト可能性のための依存性注入パターン
 */
export interface Logger {
  info(message: string): void;
  error(message: string): void;
  warn(message: string): void;
}

/**
 * Nonceリトライ処理の成功結果
 * @description 成功時のトランザクションハッシュとメタデータ
 */
export interface NonceRetrySuccessResult {
  success: true;
  transactionHash: Hex;
  explorerUrl?: string;
  finalNonce: number;
  retryCount: number;
}

/**
 * Nonceリトライ処理の失敗結果
 * @description 失敗時のエラー情報とメタデータ
 */
export interface NonceRetryFailureResult {
  success: false;
  error: Error;
  finalNonce: number;
  retryCount: number;
}

/**
 * Nonceリトライ処理の結果
 * @description 成功または失敗の判別可能なユニオン型
 */
export type NonceRetryResult = NonceRetrySuccessResult | NonceRetryFailureResult;

/**
 * Nonceエラーの判定
 * @param error エラーオブジェクト
 * @returns Nonceエラーの場合true
 * @description ドメイン層のスキーマを使用したエラー判定
 */
function isNonceError(error: unknown): boolean {
  return validateNonceError(error);
}

/**
 * 指数関数的バックオフによる待機
 * @param attempt 現在の試行回数（0ベース）
 * @param baseDelay ベース遅延時間（ミリ秒）
 * @description リトライ間隔の指数関数的増加による負荷軽減
 */
async function exponentialBackoff(attempt: number, baseDelay = 1000): Promise<void> {
  const delay = Math.min(baseDelay * 2 ** attempt, 30000); // 最大30秒
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * 失敗結果の構築
 * @param error エラーオブジェクト
 * @param finalNonce 最終Nonce
 * @param retryCount リトライ回数
 * @returns 失敗結果オブジェクト
 * @description 失敗結果の構築のみ
 */
function buildFailureResult(
  error: Error,
  finalNonce: number,
  retryCount: number
): NonceRetryFailureResult {
  return {
    success: false,
    error,
    finalNonce,
    retryCount,
  };
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
  result: { transactionHash: Hex; explorerUrl?: string | undefined },
  finalNonce: number,
  retryCount: number
): NonceRetryResult {
  const successResult: NonceRetrySuccessResult = {
    success: true,
    transactionHash: result.transactionHash,
    finalNonce,
    retryCount,
  };

  if (result.explorerUrl) {
    successResult.explorerUrl = result.explorerUrl;
  }

  return successResult;
}

/**
 * Nonceエラー時のリトライ処理
 * @param options リトライ処理オプション
 * @returns リトライ処理結果
 * @throws Error バリデーションエラーまたは予期しないエラー
 * @description Nonceエラーに特化したリトライ機構の実装
 */
export async function executeWithNonceRetry(options: NonceRetryOptions): Promise<NonceRetryResult> {
  const validatedOptions = validateNonceRetryOptions(options);

  const {
    maxRetries,
    executeTransaction,
    txParams,
    logger = {
      info: (message: string) => defaultLogger.info(message),
      warn: (message: string) => defaultLogger.warn(message),
      error: (message: string) => defaultLogger.error(message),
    },
  } = validatedOptions;

  let currentNonce = txParams.nonce;
  let lastError: Error | null = null;
  let actualAttempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    actualAttempts = attempt + 1;
    try {
      logger.info(
        `🔄 トランザクション実行中... (試行 ${actualAttempts}/${maxRetries + 1}, Nonce: ${currentNonce})`
      );

      const result = await executeTransaction(currentNonce);

      logger.info(`✅ トランザクション成功 (Nonce: ${currentNonce})`);
      return buildSuccessResult(result, currentNonce, attempt);
    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      lastError = errorObj;

      if (isNonceError(error)) {
        if (attempt < maxRetries) {
          currentNonce += 1;
          logger.info(`⚠️ Nonceエラーを検出、リトライします (新しいNonce: ${currentNonce})`);

          if (attempt > 0) {
            await exponentialBackoff(attempt - 1);
          }
          continue;
        } else {
          logger.error(`❌ 最大リトライ回数に達しました (${maxRetries + 1}回試行)`);
          break;
        }
      } else {
        logger.error(`❌ Nonceエラー以外のエラーが発生しました: ${errorObj.message}`);
        break;
      }
    }
  }

  return buildFailureResult(
    lastError || new Error('不明なエラーが発生しました'),
    currentNonce,
    actualAttempts
  );
}
