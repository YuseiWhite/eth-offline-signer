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
