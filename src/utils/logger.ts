/**
 * ロガーインターフェース
 */
export interface Logger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  data: (message: string) => void;
}

/**
 * ロガー（本番環境の通常出力用）
 * @description 全ての補助情報はstderrに出力し、データ出力のみstdoutに出力
 */
const productionLogger: Logger = {
  info: (message: string) => console.error(message),
  warn: (message: string) => console.warn(message),
  error: (message: string) => console.error(message),
  data: (message: string) => console.log(message),
};

/**
 * ロガー（Quietモード用）
 * @description ログは抑制し、データ出力とエラーのみ行う
 */
const quietLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: (message: string) => console.error(message),
  data: (message: string) => console.log(message),
};

/**
 * オプションに応じて適切なロガーを生成するファクトリ関数
 * @param options コマンドラインから受け取ったオプション
 * @returns 適切なロガーインスタンス
 * @description quietモードの判定ロジックをロガー生成時に集約
 */
export function createLogger(options: { quiet?: boolean }): Logger {
  if (options.quiet) {
    return quietLogger;
  }
  return productionLogger;
}

/**
 * デフォルトロガーインスタンス
 * @description 既存コードとの互換性を保ちつつ、新しいファクトリ関数への移行を促進
 */
export const logger: Logger = productionLogger;

/**
 * テスト用のロガーオーバーライド機能
 * @description テストでlogger出力をスパイする場合に使用
 */
export function createTestLogger(): Logger {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    data: () => {},
  };
}
