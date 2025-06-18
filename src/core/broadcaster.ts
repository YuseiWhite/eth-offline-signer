import type { Hex } from 'viem';
import {
  http,
  type Chain,
  type Transaction,
  createPublicClient,
  createWalletClient,
  keccak256,
} from 'viem';
import { BroadcastError, NetworkError } from '../utils/errors';
import { type NetworkConfigOverrides, getNetworkConfig } from './networkConfig';

/**
 * ブロードキャスト結果の型定義
 * @description トランザクションハッシュとエクスプローラーURLを提供
 */
interface BroadcastResult {
  transactionHash: Hex;
  explorerUrl: string;
}

/**
 * ロガーインターフェース（依存性注入用）
 */
interface Logger {
  info(message: string): void;
  error(message: string): void;
}

/**
 * ブロードキャストオプション
 */
interface BroadcastOptions {
  logger?: Logger;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * デフォルトコンソールロガー
 */
const DEFAULT_LOGGER: Logger = {
  info: (message) => console.info(message),
  error: (message) => console.error(message),
};

/**
 * RPC URLの堅牢な検証
 * @param rpcUrl 検証対象のRPC URL
 * @throws NetworkError 不正なURLの場合
 */
function validateRpcUrl(rpcUrl: string): void {
  if (!rpcUrl || typeof rpcUrl !== 'string') {
    throw new NetworkError('RPC URLが指定されていません');
  }

  try {
    const url = new URL(rpcUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new NetworkError(
        `不正なRPCプロトコル: ${url.protocol}。HTTP/HTTPSのみサポートされています`
      );
    }

    // ホスト名の基本検証
    if (!url.hostname || url.hostname.length === 0) {
      throw new NetworkError('RPC URLのホスト名が無効です');
    }
  } catch (error) {
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError(`不正なRPC URL形式: ${rpcUrl}`);
  }
}

/**
 * トランザクションハッシュの計算
 * @param signedTransaction 署名済みトランザクション
 * @returns 計算されたトランザクションハッシュ
 * @description keccak256を使用してトランザクションハッシュを計算
 */
function calculateTransactionHash(signedTransaction: Hex): Hex {
  return keccak256(signedTransaction);
}

/**
 * 指数バックオフによる待機
 * @param attempt 試行回数（0ベース）
 * @param baseDelay ベース遅延時間（ミリ秒）
 */
async function exponentialBackoff(attempt: number, baseDelay: number): Promise<void> {
  const delay = baseDelay * 2 ** attempt;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * 再試行機能付きRPC通信
 * @param transactionHash 取得対象のトランザクションハッシュ
 * @param rpcUrl 使用するRPCエンドポイント
 * @param chain viemチェーン設定
 * @param maxRetries 最大再試行回数
 * @param retryDelay ベース遅延時間
 * @param logger ロガーインスタンス
 * @returns トランザクション情報（存在しない場合はnull）
 */
async function fetchTransactionFromRpc(
  transactionHash: Hex,
  rpcUrl: string,
  chain: Chain,
  maxRetries = 3,
  retryDelay = 1000,
  logger: Logger = DEFAULT_LOGGER
): Promise<Transaction | null> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      });

      const transaction = await publicClient.getTransaction({ hash: transactionHash });

      if (attempt > 0) {
        logger.info(`RPC取得成功（${attempt + 1}回目の試行）: ${transactionHash}`);
      }

      return transaction;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      lastError = new Error(errorMessage);

      if (attempt < maxRetries) {
        logger.info(`RPC取得失敗、再試行中... (${attempt + 1}/${maxRetries + 1}): ${errorMessage}`);
        await exponentialBackoff(attempt, retryDelay);
      }
    }
  }

  const message = lastError?.message || 'Unknown error';
  throw new BroadcastError(`RPC取得失敗（${maxRetries + 1}回試行）: ${message}`);
}

/**
 * 既知エラーの判定
 * @param error 判定対象のエラーオブジェクト
 * @returns 既知のエラーであればtrue、そうでなければfalse
 */
function isKnownTransactionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const errorObj = error as Error & { details?: string };
  return (
    (typeof errorObj.details === 'string' && errorObj.details.includes('already known')) ||
    errorObj.message.includes('already known')
  );
}

/**
 * 既知のトランザクションエラーの処理
 * @param signedTransaction 署名済みトランザクション（ハッシュ計算用）
 * @param rpcUrl トランザクション確認用のRPCエンドポイント
 * @param chain viemチェーン設定
 * @param maxRetries 最大再試行回数
 * @param retryDelay ベース遅延時間
 * @param logger ロガーインスタンス
 * @returns トランザクションハッシュ（確認済み）
 * @throws BroadcastError トランザクション確認に失敗した場合
 * @description 既知のトランザクションの存在確認とハッシュ返却
 */
async function handleKnownTransactionError(
  signedTransaction: Hex,
  rpcUrl: string,
  chain: Chain,
  maxRetries: number,
  retryDelay: number,
  logger: Logger
): Promise<Hex> {
  const hash = calculateTransactionHash(signedTransaction);
  logger.info(`🔍 既知のトランザクション確認中: ${hash}`);

  const transaction = await fetchTransactionFromRpc(
    hash,
    rpcUrl,
    chain,
    maxRetries,
    retryDelay,
    logger
  );
  if (transaction) {
    logger.info(`✅ トランザクション確認済み: ${hash}`);
    return hash;
  }

  throw new BroadcastError(`既知のトランザクションが確認できませんでした: ${hash}`);
}

/**
 * エクスプローラーURLの安全な生成
 * @param transactionHash トランザクションハッシュ
 * @param explorerBaseUrl エクスプローラーのベースURL
 * @returns 生成されたエクスプローラーURL
 * @description XSS攻撃を防ぐためURLエンコーディングを実行
 */
function generateExplorerUrl(transactionHash: Hex, explorerBaseUrl: string): string {
  // XSS対策：URLエンコーディング
  const sanitizedHash = encodeURIComponent(transactionHash);
  return `${explorerBaseUrl}/tx/${sanitizedHash}`;
}

/**
 * 署名済みトランザクションのブロードキャスト
 * @param signedTransaction 署名済みトランザクション（0xプレフィックス付き）
 * @param chainId 対象チェーンID
 * @param rpcUrl カスタムRPCエンドポイント
 * @param customNetworkConfigs オプション: ネットワーク設定の上書き・追加
 * @param options オプション: ロガー、再試行設定
 * @returns ブロードキャスト結果
 * @throws NetworkError ネットワーク設定エラーの場合
 * @throws BroadcastError ブロードキャスト失敗の場合
 */
export async function broadcastTransaction(
  signedTransaction: Hex,
  chainId: number,
  rpcUrl: string,
  customNetworkConfigs?: NetworkConfigOverrides,
  options: BroadcastOptions = {}
): Promise<BroadcastResult> {
  const { logger = DEFAULT_LOGGER, maxRetries = 3, retryDelay = 1000 } = options;

  // 入力検証
  if (!signedTransaction || typeof signedTransaction !== 'string') {
    throw new BroadcastError('署名済みトランザクションが指定されていません');
  }

  // 設定取得とRPC検証
  const networkConfig = getNetworkConfig(chainId, customNetworkConfigs);
  validateRpcUrl(rpcUrl);

  // viemクライアント作成
  const client = createWalletClient({
    chain: networkConfig.chain,
    transport: http(rpcUrl, {
      timeout: 30000,
      retryCount: 3,
      retryDelay: 1000,
    }),
  });

  // ブロードキャスト実行
  logger.info(`🌐 ${networkConfig.name} (${networkConfig.chain.id}) へブロードキャスト中...`);

  try {
    const hash = await client.sendRawTransaction({
      serializedTransaction: signedTransaction,
    });

    logger.info(`✅ ブロードキャスト成功: ${hash}`);

    return {
      transactionHash: hash,
      explorerUrl: generateExplorerUrl(hash, networkConfig.explorerBaseUrl),
    };
  } catch (error: unknown) {
    if (isKnownTransactionError(error)) {
      const hash = await handleKnownTransactionError(
        signedTransaction,
        rpcUrl,
        networkConfig.chain,
        maxRetries,
        retryDelay,
        logger
      );
      return {
        transactionHash: hash,
        explorerUrl: generateExplorerUrl(hash, networkConfig.explorerBaseUrl),
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    logger.error(`❌ ブロードキャストエラー: ${message}`);
    throw new BroadcastError(`ブロードキャスト失敗: ${message}`);
  }
}

export { getAllSupportedNetworks } from './networkConfig';
