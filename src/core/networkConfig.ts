import type { Chain } from 'viem';
import { anvil, hoodi, sepolia } from 'viem/chains';
import { NetworkError } from '../utils/errors';
import {
  RpcUrlSchema,
  ChainIdSchema,
  ChainConfigSchema,
  NetworkConfigSchema,
} from '../types/schema';

/**
 * チェーンID定数定義
 * @description マジックナンバーを避けるための定数定義
 */
const ANVIL_CHAIN_ID = 31337 as const;
const SEPOLIA_CHAIN_ID = 11155111 as const;
const HOODI_CHAIN_ID = 560048 as const;

/**
 * Anvilチェーン判定（型ガード）
 * @param chainId 判定対象のチェーンID
 * @returns AnvilチェーンIDの場合true
 */
function isAnvilChainId(chainId: number): chainId is typeof ANVIL_CHAIN_ID {
  return chainId === ANVIL_CHAIN_ID;
}

/**
 * 実行環境判定によるAnvil RPC URLの決定
 * @description 環境変数 > Docker判定 > デフォルト の優先順位
 * @returns 適切なRPC URL
 */
function getAnvilRpcUrl(): string {
  // 環境変数での明示的指定を最優先
  if (process.env.ANVIL_RPC_URL) {
    const urlResult = RpcUrlSchema.safeParse(process.env.ANVIL_RPC_URL);
    if (!urlResult.success) {
      throw new NetworkError(
        `ANVIL_RPC_URL環境変数のURL形式が無効です: ${urlResult.error.issues[0]?.message || '不正なURL形式'}`
      );
    }
    return process.env.ANVIL_RPC_URL;
  }

  // Docker環境の簡易判定（環境変数ベース）
  if (process.env.DOCKER_CONTAINER || process.env.HOSTNAME?.includes('docker')) {
    return 'http://anvil:8545';
  }

  return 'http://localhost:8545';
}

/**
 * ネットワーク設定の型定義
 * @description RPCエンドポイント、エクスプローラー、viemチェーン設定を統合
 */
export interface NetworkConfig {
  explorerBaseUrl: string;
  name: string;
  chain: Chain;
}

/**
 * ネットワーク設定の上書きまたは追加のための型定義
 */
export type NetworkConfigOverrides = Record<number, Partial<NetworkConfig>>;

/**
 * Anvil用の動的ネットワーク設定生成
 * @description 実行時環境に応じて適切な設定を生成
 * @returns Anvilネットワーク設定
 */
function createAnvilNetworkConfig(): NetworkConfig {
  const anvilRpcUrl = getAnvilRpcUrl();
  return {
    explorerBaseUrl: anvilRpcUrl, // RPC URLと一致させる（本番では削除予定）
    name: 'Anvil Local Network',
    chain: {
      ...anvil,
      rpcUrls: {
        default: { http: [anvilRpcUrl] },
        public: { http: [anvilRpcUrl] },
      },
      blockExplorers: {
        default: { name: 'Anvil', url: anvilRpcUrl },
      },
      testnet: true,
    },
  };
}

/**
 * 不変のネットワーク設定（読み取り専用）
 * @description セキュリティ強化：意図しない設定変更を防止
 */
const BUILTIN_NETWORK_CONFIGS = {
  [SEPOLIA_CHAIN_ID]: {
    explorerBaseUrl: 'https://sepolia.etherscan.io',
    name: 'Sepolia Testnet',
    chain: sepolia,
  },
  [HOODI_CHAIN_ID]: {
    explorerBaseUrl: 'https://hoodi.etherscan.io',
    name: 'Hoodi Testnet',
    chain: hoodi,
  },
} as const satisfies Record<number, NetworkConfig>;

/**
 * ビルトインでサポートされているチェーンIDの型定義
 * @description コンパイル時型チェック用（オプショナル使用）
 */
export type BuiltinChainId = keyof typeof BUILTIN_NETWORK_CONFIGS;

/**
 * ビルトインチェーンID判定（型ガード）
 * @param chainId 判定対象のチェーンID
 * @returns ビルトインチェーンIDの場合true
 */
export function isBuiltinChainId(chainId: number): chainId is BuiltinChainId {
  return chainId in BUILTIN_NETWORK_CONFIGS;
}

/**
 * チェーンIDの基本検証
 * @param chainId 検証対象のチェーンID
 * @throws NetworkError 不正なチェーンIDの場合
 * @description ドメイン層のスキーマを使用
 */
function validateChainId(chainId: number): void {
  const result = ChainIdSchema.safeParse(chainId);
  if (!result.success) {
    throw new NetworkError(`不正なチェーンID: ${chainId} (${result.error.issues[0]?.message})`);
  }
}

/**
 * チェーン設定の完全性検証
 * @param chain viemチェーン設定
 * @param chainId チェーンID
 * @throws NetworkError 不正なチェーン設定の場合
 * @description ドメイン層のスキーマを使用
 */
function validateChainConfig(chain: Chain, chainId: number): void {
  const result = ChainConfigSchema.safeParse(chain);
  if (!result.success) {
    throw new NetworkError(
      `チェーン設定が無効です (Chain ID: ${chainId}): ${result.error.issues[0]?.message}`
    );
  }

  if (chain.id !== chainId) {
    throw new NetworkError(`チェーン設定のIDが一致しません: 期待値=${chainId}, 実際値=${chain.id}`);
  }
}

/**
 * ネットワーク設定の完全性検証
 * @param config ネットワーク設定
 * @param chainId チェーンID
 * @throws NetworkError 不正なネットワーク設定の場合
 * @description ドメイン層のスキーマを使用
 */
function validateNetworkConfig(config: NetworkConfig, chainId: number): void {
  const result = NetworkConfigSchema.safeParse(config);
  if (!result.success) {
    throw new NetworkError(
      `ネットワーク設定が無効です (Chain ID: ${chainId}): ${result.error.issues[0]?.message}`
    );
  }

  validateChainConfig(config.chain, chainId);
}

/**
 * Anvilネットワーク設定取得（該当する場合のみ）
 * @param chainId チェーンID
 * @returns Anvilネットワーク設定またはundefined
 * @description Anvilの場合のみ動的設定を生成
 */
function getAnvilConfigIfApplicable(chainId: number): NetworkConfig | undefined {
  if (isAnvilChainId(chainId)) {
    return createAnvilNetworkConfig();
  }
  return undefined;
}

/**
 * ビルトインネットワーク設定取得
 * @param chainId チェーンID
 * @returns ビルトインネットワーク設定またはundefined
 * @description 事前定義されたネットワーク設定の取得
 */
function getBuiltinNetworkConfig(chainId: number): NetworkConfig | undefined {
  if (isBuiltinChainId(chainId)) {
    return BUILTIN_NETWORK_CONFIGS[chainId];
  }
  return undefined;
}

/**
 * 新規ネットワーク設定のバリデーション
 * @param override 設定オーバーライド
 * @param chainId チェーンID
 * @throws NetworkError 不正な設定の場合
 * @description 新規追加される設定の検証
 */
function validateNewNetworkConfig(
  override: Partial<NetworkConfig>,
  chainId: number
): asserts override is NetworkConfig {
  if (!override.chain) {
    throw new NetworkError(`新規ネットワーク設定にはchain設定が必要です (Chain ID: ${chainId})`);
  }

  if (!override.name) {
    throw new NetworkError(`新規ネットワーク設定にはname設定が必要です (Chain ID: ${chainId})`);
  }

  if (!override.explorerBaseUrl) {
    throw new NetworkError(
      `新規ネットワーク設定にはexplorerBaseUrl設定が必要です (Chain ID: ${chainId})`
    );
  }
}

/**
 * 既存設定のマージ
 * @param baseConfig ベース設定
 * @param override オーバーライド設定
 * @param chainId チェーンID
 * @returns マージされた設定
 * @description 既存設定に対する部分的なオーバーライド
 */
function mergeExistingConfig(
  baseConfig: NetworkConfig,
  override: Partial<NetworkConfig>,
  chainId: number
): NetworkConfig {
  const merged = {
    ...baseConfig,
    ...override,
    chain: override.chain ? { ...baseConfig.chain, ...override.chain } : baseConfig.chain,
  };

  validateNetworkConfig(merged, chainId);
  return merged;
}

/**
 * 新規設定の追加
 * @param override 新規設定
 * @param chainId チェーンID
 * @returns 新規ネットワーク設定
 * @description 完全に新しいネットワーク設定の作成
 */
function addNewConfig(override: Partial<NetworkConfig>, chainId: number): NetworkConfig {
  validateNewNetworkConfig(override, chainId);

  const newConfig: NetworkConfig = {
    explorerBaseUrl: override.explorerBaseUrl,
    name: override.name,
    chain: override.chain,
  };

  validateNetworkConfig(newConfig, chainId);
  return newConfig;
}

/**
 * ネットワーク設定のマージ処理
 * @param overrides 設定オーバーライド
 * @returns マージされた設定マップ
 * @description カスタム設定とビルトイン設定のマージ
 */
function mergeNetworkConfigs(overrides: NetworkConfigOverrides): Record<number, NetworkConfig> {
  const merged: Record<number, NetworkConfig> = {};

  // ビルトイン設定をベースとして追加
  for (const [chainIdStr, config] of Object.entries(BUILTIN_NETWORK_CONFIGS)) {
    const chainId = Number(chainIdStr);
    merged[chainId] = config;
  }

  // オーバーライド設定を適用
  for (const [chainIdStr, override] of Object.entries(overrides)) {
    const chainId = Number(chainIdStr);
    validateChainId(chainId);

    const baseConfig = merged[chainId] || getAnvilConfigIfApplicable(chainId);

    if (baseConfig) {
      merged[chainId] = mergeExistingConfig(baseConfig, override, chainId);
    } else {
      merged[chainId] = addNewConfig(override, chainId);
    }
  }

  return merged;
}

/**
 * ネットワーク設定の取得（ビルトインチェーンID用）
 * @param chainId ビルトインチェーンID
 * @param customNetworkConfigs カスタムネットワーク設定（オプション）
 * @returns ネットワーク設定
 * @throws NetworkError 設定取得に失敗した場合
 */
export function getNetworkConfig(
  chainId: BuiltinChainId,
  customNetworkConfigs?: NetworkConfigOverrides
): NetworkConfig;

/**
 * ネットワーク設定の取得（任意のチェーンID用）
 * @param chainId チェーンID
 * @param customNetworkConfigs カスタムネットワーク設定（オプション）
 * @returns ネットワーク設定
 * @throws NetworkError 設定取得に失敗した場合
 */
export function getNetworkConfig(
  chainId: number,
  customNetworkConfigs?: NetworkConfigOverrides
): NetworkConfig;

/**
 * ネットワーク設定の取得（統合実装）
 * @param chainId チェーンID
 * @param customNetworkConfigs カスタムネットワーク設定（オプション）
 * @returns ネットワーク設定
 * @throws NetworkError 設定取得に失敗した場合
 * @description ビジネスロジックの調整とワークフロー制御
 */
export function getNetworkConfig(
  chainId: number,
  customNetworkConfigs?: NetworkConfigOverrides
): NetworkConfig {
  validateChainId(chainId);

  // カスタム設定が提供されている場合はマージ処理
  if (customNetworkConfigs) {
    const mergedConfigs = mergeNetworkConfigs(customNetworkConfigs);
    const config = mergedConfigs[chainId];
    if (config) {
      return config;
    }
  }

  // Anvil設定の確認
  const anvilConfig = getAnvilConfigIfApplicable(chainId);
  if (anvilConfig) {
    return anvilConfig;
  }

  // ビルトイン設定の確認
  const builtinConfig = getBuiltinNetworkConfig(chainId);
  if (builtinConfig) {
    return builtinConfig;
  }

  throw new NetworkError(
    `未サポートのチェーンID: ${chainId}. サポートされているチェーンID: ${Object.keys(BUILTIN_NETWORK_CONFIGS).join(', ')}, ${ANVIL_CHAIN_ID}`
  );
}

/**
 * サポートされているすべてのネットワークの取得
 * @returns サポートされているネットワークの配列
 * @description 利用可能なネットワーク一覧の提供
 */
export function getAllSupportedNetworks(): Array<{ chainId: number; config: NetworkConfig }> {
  const networks: Array<{ chainId: number; config: NetworkConfig }> = [];

  // ビルトインネットワークを追加
  for (const [chainIdStr, config] of Object.entries(BUILTIN_NETWORK_CONFIGS)) {
    networks.push({
      chainId: Number(chainIdStr),
      config,
    });
  }

  // Anvilネットワークを追加
  networks.push({
    chainId: ANVIL_CHAIN_ID,
    config: createAnvilNetworkConfig(),
  });

  return networks;
}

/**
 * ネットワークタイプの定義
 * @description UI表示用のネットワーク種別
 */
export type NetworkType = 'testnet' | 'custom';

/**
 * 表示用ネットワーク情報
 * @description UI表示に最適化された情報
 */
export interface DisplayNetworkInfo {
  name: string;
  explorer: string;
  type: NetworkType;
}

/**
 * ネットワークタイプの判定
 * @param chainId チェーンID
 * @returns ネットワークタイプ
 * @description UI表示用の分類
 */
function getNetworkType(chainId: number): NetworkType {
  if (isAnvilChainId(chainId) || isBuiltinChainId(chainId)) {
    return 'testnet';
  }
  return 'custom';
}

/**
 * 表示用ネットワーク情報の取得
 * @param chainId チェーンID
 * @returns 表示用ネットワーク情報
 * @description UI制御のための情報提供
 */
export function getDisplayNetworkInfo(chainId: number): DisplayNetworkInfo {
  try {
    const config = getNetworkConfig(chainId);
    return {
      name: config.name,
      explorer: config.explorerBaseUrl,
      type: getNetworkType(chainId),
    };
  } catch {
    return {
      name: `Unknown Network (${chainId})`,
      explorer: 'N/A',
      type: 'custom',
    };
  }
}
