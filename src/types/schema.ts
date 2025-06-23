import { z } from 'zod';
import type { Hex } from 'viem';

/**
 * Ethereumアドレスの検証スキーマ
 * @description 0xで始まる40文字の16進文字列を検証
 */
export const EthereumAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, {
  message: '無効なEthereumアドレス形式です。0xで始まる40文字の16進文字列である必要があります。',
});

/**
 * 数値文字列の検証スキーマ（wei、ガス価格等）
 * @description JavaScriptのnumber型では表現できない大きな数値を文字列として扱う
 */
export const NumericStringSchema = z.string().regex(/^\d+$/, {
  message: '無効な数値文字列です。数字のみを含む必要があります。',
});

/**
 * 16進文字列スキーマ（トランザクションハッシュ用）
 * @description 0xプレフィックス付き64文字の16進文字列
 */
export const TransactionHashSchema = z.custom<Hex>((val) => {
  return typeof val === 'string' && /^0x[a-fA-F0-9]{64}$/.test(val);
}, 'トランザクションハッシュは0xで始まる64文字の16進文字列である必要があります');

/**
 * 秘密鍵の検証スキーマ
 * @description 0xプレフィックス付き64文字の16進文字列
 */
export const PrivateKeySchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, {
  message: '無効な秘密鍵形式です。0xで始まる64文字の16進文字列である必要があります。',
});

/**
 * 生秘密鍵の検証スキーマ（0xプレフィックス無し）
 * @description 64文字の16進文字列（正規化前）
 */
export const RawPrivateKeySchema = z
  .string()
  .min(1, '秘密鍵が空です')
  .regex(/^(0x)?[0-9a-fA-F]{64}$/, '秘密鍵は64文字の16進文字列である必要があります');

/**
 * ファイルパスの検証スキーマ
 * @description 空でない文字列で、.key拡張子を持つ
 */
export const FilePathSchema = z
  .string()
  .min(1, 'ファイルパスが指定されていません')
  .refine((path) => path.endsWith('.key'), {
    message: '秘密鍵ファイルは.key拡張子である必要があります',
  });

/**
 * 秘密鍵形式の検証スキーマ（正規化後）
 * @description 0xプレフィックス付きの正規化済み秘密鍵
 */
export const PrivateKeyFormatSchema = z
  .string()
  .regex(
    /^0x[0-9a-fA-F]{64}$/,
    '秘密鍵は0xプレフィックス付きの64文字の16進文字列である必要があります'
  );

/**
 * RPC URLの検証スキーマ
 * @description HTTP/HTTPSプロトコルのURL検証と詳細ホスト名チェック
 */
export const RpcUrlSchema = z
  .string()
  .min(1, 'RPC URLが指定されていません')
  .url('不正なRPC URL形式です')
  .refine(
    (url) => {
      try {
        const parsedUrl = new URL(url);
        return ['http:', 'https:'].includes(parsedUrl.protocol);
      } catch {
        return false;
      }
    },
    { message: 'HTTP/HTTPSプロトコルのみサポートされています' }
  )
  .refine(
    (url) => {
      try {
        const parsedUrl = new URL(url);
        return parsedUrl.hostname && parsedUrl.hostname.length > 0;
      } catch {
        return false;
      }
    },
    { message: 'RPC URLのホスト名が無効です' }
  );

/**
 * チェーンIDの検証スキーマ
 * @description 正の整数のチェーンID
 */
export const ChainIdSchema = z
  .number()
  .int('チェーンIDは整数である必要があります')
  .positive('チェーンIDは正の整数である必要があります');

/**
 * ネイティブ通貨の検証スキーマ
 * @description ブロックチェーンのネイティブ通貨情報
 */
export const NativeCurrencySchema = z.object({
  name: z.string().min(1, '通貨名が必要です'),
  symbol: z.string().min(1, '通貨シンボルが必要です'),
  decimals: z.number().int().nonnegative('小数点以下桁数は0以上である必要があります'),
});

/**
 * チェーン設定の検証スキーマ
 * @description viemチェーン設定オブジェクト
 */
export const ChainConfigSchema = z.object({
  id: ChainIdSchema,
  name: z.string().min(1, 'チェーン名が必要です'),
  nativeCurrency: NativeCurrencySchema,
  rpcUrls: z.object({
    default: z.object({
      http: z.array(z.string().url()),
    }),
  }),
});

/**
 * ネットワーク設定の検証スキーマ
 * @description 完全なネットワーク設定
 */
export const NetworkConfigSchema = z.object({
  explorerBaseUrl: z.string().min(1, 'explorerBaseUrlが必要です'),
  name: z.string().min(1, 'nameが必要です'),
  chain: ChainConfigSchema,
});

/**
 * ロガーインターフェースの検証スキーマ
 * @description 依存性注入されるロガーの構造検証
 */
export const LoggerSchema = z.object({
  info: z.function().args(z.string()).returns(z.void()),
  error: z.function().args(z.string()).returns(z.void()),
});

/**
 * 署名済みトランザクションの検証スキーマ
 * @description 0xプレフィックス付き16進文字列の検証
 */
export const SignedTransactionSchema = z
  .string()
  .min(1, '署名済みトランザクションが指定されていません')
  .regex(
    /^0x[0-9a-fA-F]+$/,
    '署名済みトランザクションは0xプレフィックス付きの16進文字列である必要があります'
  )
  .transform((val): Hex => val as Hex);

/**
 * エラーオブジェクトの検証スキーマ
 * @description 既知のトランザクションエラー判定用
 */
export const ErrorObjectSchema = z
  .object({
    message: z.string().optional().default(''),
    details: z.string().optional(),
    cause: z
      .object({
        message: z.string().optional(),
      })
      .optional(),
  })
  .passthrough(); // 他のエラープロパティも許可

/**
 * エラー文字列の検証スキーマ
 * @description 空でないエラーメッセージ
 */
export const ErrorStringSchema = z.string().min(1, 'エラーメッセージが空です');

/**
 * CLIオプションの検証スキーマ
 * @description コマンドライン引数の検証
 */
export const CliOptionsSchema = z
  .object({
    keyFile: z
      .string()
      .min(1, '--key-fileオプションで秘密鍵ファイルへのパスを指定する必要があります。'),
    params: z
      .string()
      .min(
        1,
        '--paramsオプションでトランザクションパラメータファイルへのパスを指定する必要があります。'
      ),
    broadcast: z.boolean().default(false),
    rpcUrl: z.string().url('有効なRPCエンドポイントのURLを指定してください。').optional(),
  })
  .refine((data) => !data.broadcast || data.rpcUrl !== undefined, {
    message:
      '--broadcastオプションを使用する場合は、--rpc-urlオプションでRPCエンドポイントを指定する必要があります。',
    path: ['rpcUrl'],
  });

/**
 * Package.jsonの検証スキーマ
 * @description バージョン情報取得用の最小限検証
 */
export const PackageJsonSchema = z
  .object({
    version: z.string().min(1, 'versionフィールドが空です'),
  })
  .passthrough();

/**
 * EIP-2930 アクセスリスト項目のスキーマ
 * @description ガス最適化のためのストレージアクセス事前宣言（EIP-1559ではオプション）
 */
export const AccessListItemSchema = z.object({
  address: EthereumAddressSchema,
  storageKeys: z.array(
    z.string().regex(/^0x[a-fA-F0-9]{64}$/, {
      message: '無効なストレージキー形式です。0xで始まる64文字の16進文字列である必要があります。',
    })
  ),
});

/**
 * EIP-1559 トランザクションパラメータスキーマ
 * @description EIP-1559専用フィールドのみを許可し、他のトランザクション種別のフィールドを排除
 */
export const EIP1559TxParamsSchema = z
  .object({
    to: EthereumAddressSchema,
    value: NumericStringSchema,
    chainId: z.number().int().positive({ message: 'chainIdは正の整数である必要があります。' }),
    nonce: z.number().int().nonnegative({ message: 'nonceは0以上の整数である必要があります。' }),
    gasLimit: NumericStringSchema,
    maxFeePerGas: NumericStringSchema,
    maxPriorityFeePerGas: NumericStringSchema,
    accessList: z.array(AccessListItemSchema).optional(),
  })
  .strict({ message: 'EIP-1559トランザクションで許可されていないフィールドが含まれています。' });

/**
 * トランザクション実行関数の戻り値スキーマ
 * @description executeTransaction関数の戻り値型安全性保証
 */
export const ExecuteTransactionResultSchema = z.object({
  transactionHash: TransactionHashSchema,
  explorerUrl: z.string().url('explorerUrlは有効なURLである必要があります').optional(),
});

/**
 * トランザクション実行関数のスキーマ
 * @description executeTransaction関数の型安全性保証
 */
export const ExecuteTransactionSchema = z
  .function()
  .args(z.number().int().nonnegative('nonceは0以上の整数である必要があります'))
  .returns(z.promise(ExecuteTransactionResultSchema));

/**
 * NonceRetryOptionsの検証スキーマ
 * @description 入力パラメータの包括的検証
 */
export const NonceRetryOptionsSchema = z.object({
  maxRetries: z
    .number()
    .int()
    .min(1, 'maxRetriesは1以上である必要があります')
    .max(10, 'maxRetriesは10以下である必要があります'),
  executeTransaction: ExecuteTransactionSchema,
  txParams: EIP1559TxParamsSchema,
  logger: LoggerSchema.optional(),
});

const TransactionProcessorBaseSchema = z.object({
  privateKey: PrivateKeySchema,
  txParams: EIP1559TxParamsSchema,
  maxRetries: z.number().int().min(1).max(10).optional().default(3),
  logger: LoggerSchema.optional(),
});

const SignAndBroadcastSchema = z.object({
  broadcast: z.literal(true),
  rpcUrl: RpcUrlSchema,
});

const SignOnlySchema = z.object({
  broadcast: z.literal(false).optional(),
  rpcUrl: z.undefined({
    errorMap: () => ({ message: 'broadcastがfalseの場合、rpcUrlは指定できません' }),
  }).optional(),
});

export const TransactionProcessorOptionsSchema = z.intersection(
  TransactionProcessorBaseSchema,
  z.discriminatedUnion('broadcast', [
    SignAndBroadcastSchema,
    SignOnlySchema,
  ])
);

export type TransactionProcessorOptions = z.input<typeof TransactionProcessorOptionsSchema>;

/**
 * EIP-1559トランザクションパラメータの検証
 * @param params 検証対象のパラメータ（任意の型）
 * @returns 検証済みのEIP-1559トランザクションパラメータ
 * @throws ZodError 検証に失敗した場合（zodのネイティブエラー）
 * @description エラーハンドリングは呼び出し側で行い、typesレイヤーの純粋性を保持
 */
export function validateEIP1559TxParams(params: unknown): EIP1559TxParams {
  return EIP1559TxParamsSchema.parse(params);
}

/**
 * CLIオプションの検証
 * @param options 検証対象のオプション
 * @returns 検証済みのCLIオプション
 * @throws ZodError 検証に失敗した場合
 */
export function validateCliOptions(options: unknown): CliOptions {
  return CliOptionsSchema.parse(options);
}

/**
 * ネットワーク設定の検証
 * @param config 検証対象の設定
 * @returns 検証済みのネットワーク設定
 * @throws ZodError 検証に失敗した場合
 */
export function validateNetworkConfig(config: unknown): NetworkConfig {
  return NetworkConfigSchema.parse(config);
}

/**
 * トランザクションプロセッサーオプションの検証
 * @param options 検証対象のオプション
 * @returns 検証済みのオプション
 * @throws ZodError 検証に失敗した場合
 */
export function validateTransactionProcessorOptions(
  options: unknown
): z.output<typeof TransactionProcessorOptionsSchema> {
  return TransactionProcessorOptionsSchema.parse(options);
}

/**
 * NonceRetryオプションの検証
 * @param options 検証対象のオプション
 * @returns 検証済みのオプション
 * @throws ZodError 検証に失敗した場合
 */
export function validateNonceRetryOptions(options: unknown): NonceRetryOptions {
  return NonceRetryOptionsSchema.parse(options);
}

/**
 * Nonceエラー判定用のエラーオブジェクトスキーマ
 * @description エラーオブジェクトの構造検証
 */
const NonceErrorSchema = z
  .object({
    message: z.string().optional().default(''),
    details: z.string().optional(),
    cause: z
      .object({
        message: z.string().optional(),
      })
      .optional(),
  })
  .passthrough(); // 他のエラープロパティも許可

/**
 * Nonceエラーの検出パターン
 * @description セキュリティ上の理由でreadonlyで定義
 */
const NONCE_ERROR_PATTERNS = [
  'nonce too low',
  'nonce too high',
  'invalid nonce',
  'nonce.*expected',
  'replacement transaction underpriced',
  'transaction already known',
] as const;

/**
 * 事前コンパイル済み正規表現
 * @description パフォーマンス向上のため事前コンパイル
 */
const PRECOMPILED_NONCE_ERROR_PATTERNS = NONCE_ERROR_PATTERNS.map(
  (pattern) => new RegExp(pattern, 'i')
) as readonly RegExp[];

/**
 * Nonceエラーの検証
 * @param error 検証対象のエラー
 * @returns Nonceエラーの場合true
 * @description エラーメッセージからNonceエラーかどうかを判定
 */
export function validateNonceError(error: unknown): boolean {
  const errorResult = NonceErrorSchema.safeParse(error);
  if (!errorResult.success) {
    return false;
  }

  const errorObj = errorResult.data;
  const messagesToCheck = [
    errorObj.message || '',
    errorObj.details || '',
    errorObj.cause?.message || '',
  ];

  return PRECOMPILED_NONCE_ERROR_PATTERNS.some((regex) =>
    messagesToCheck.some((message) => regex.test(message))
  );
}
