import { http, createPublicClient } from 'viem';
import type { Hex } from 'viem';
import { hoodi, sepolia } from 'viem/chains';
import type { EIP1559TxParams } from '../types/schema';

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
 * チェーンIDに基づく適切なチェーン設定の取得
 * @param chainId 対象チェーンID
 * @returns viemチェーン設定
 * @throws Error 未知のチェーンIDの場合
 * @description Sepolia、Hoodi、Anvil（31337）をサポート、未知IDはエラー
 */
function getChainConfig(chainId: number) {
  switch (chainId) {
    case 11155111:
      return sepolia;
    case 560048:
      return hoodi;
    case 31337:
      // Anvil Local Network
      return sepolia;
    default:
      throw new Error(`未対応のチェーンID: ${chainId}。サポートされているチェーンID: 11155111 (Sepolia), 560048 (Hoodi), 31337 (Anvil)`);
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

/**
 * トランザクションレシートの取得と結果構築
 * @param retryResult Nonceリトライ処理の成功結果
 * @param txParams トランザクションパラメータ（チェーンID取得用）
 * @param rpcUrl レシート取得用RPCエンドポイント
 * @param logger ロガー
 * @returns ブロードキャスト結果（ブロック情報とガス使用量を含む）
 * @throws Error トランザクションハッシュが存在しない場合
 * @description waitForTransactionReceiptでマイニング完了を待機、エラー時もハッシュは表示
 */
async function handleTransactionReceipt(
  retryResult: NonceRetryResult,
  txParams: EIP1559TxParams,
  rpcUrl: string,
  logger: Logger
): Promise<NonNullable<TransactionProcessorResult['broadcast']>> {
  if (!retryResult.transactionHash) {
    throw new Error('Transaction hash is required for receipt handling');
  }

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
    return buildSuccessBroadcastResult(retryResult, receipt);
  } catch (receiptError: unknown) {
    const errorMessage =
      receiptError instanceof Error ? receiptError.message : String(receiptError);

    logTransactionError(retryResult, errorMessage, logger);
    return buildErrorBroadcastResult(retryResult, errorMessage);
  }
}

