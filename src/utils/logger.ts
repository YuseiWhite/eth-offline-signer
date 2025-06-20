/**
 * 🔧 テスト制御可能ロガーシステム
 * テスト環境では出力を抑制し、本番環境では通常出力する
 */

/**
 * ロガーインターフェース
 */
export interface Logger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

/**
 * テスト環境判定
 */
function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
}

/**
 * 本番用ロガー（標準コンソール出力）
 */
const productionLogger: Logger = {
  info: (message: string) => console.info(message),
  warn: (message: string) => console.warn(message),
  error: (message: string) => console.error(message),
};

/**
 * テスト用サイレントロガー（出力なし）
 */
const silentLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

/**
 * 現在の環境に適したロガーインスタンス
 * テスト環境では自動的にサイレントモードになる
 */
export const logger: Logger = isTestEnvironment() ? silentLogger : productionLogger;

/**
 * テスト用のロガーオーバーライド機能
 * テストでlogger出力をスパイする場合に使用
 */
export function createTestLogger(): Logger {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}