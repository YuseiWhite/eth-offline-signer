/**
 * 🔧 ロガーシステム
 * 本番環境では通常出力する
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
 * ロガー（標準コンソール出力）
 */
const productionLogger: Logger = {
  info: (message: string) => console.info(message),
  warn: (message: string) => console.warn(message),
  error: (message: string) => console.error(message),
};

/**
 * 現在の環境に適したロガーインスタンス
 */
export const logger: Logger = productionLogger;

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
