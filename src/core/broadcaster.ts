import type { Hex } from 'viem';

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
