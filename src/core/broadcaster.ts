import type { Hex } from 'viem';
import { NetworkError } from '../utils/errors';

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
