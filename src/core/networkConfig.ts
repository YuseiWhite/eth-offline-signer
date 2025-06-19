import type { Chain } from 'viem';
import { anvil, hoodi, sepolia } from 'viem/chains';
import { NetworkError } from '../utils/errors';

/**
 * 実行環境判定によるAnvil RPC URLの決定
 * @description 環境変数 > Docker判定 > デフォルト の優先順位
 * @returns 適切なRPC URL
 */
function getAnvilRpcUrl(): string {
  // 環境変数での明示的指定を最優先
  if (process.env.ANVIL_RPC_URL) {
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
  11155111: {
    explorerBaseUrl: 'https://sepolia.etherscan.io',
    name: 'Sepolia Testnet',
    chain: sepolia,
  },
  560048: {
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
 * URL形式の堅牢な検証
 * @param url 検証対象のURL
 * @param fieldName フィールド名（エラーメッセージ用）
 * @throws NetworkError 不正なURL形式の場合
 */
function validateUrl(url: string, fieldName: string): void {
  if (!url || typeof url !== 'string') {
    throw new NetworkError(`${fieldName}が指定されていません`);
  }

  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new NetworkError(
        `${fieldName}は有効なHTTP/HTTPSプロトコルである必要があります: ${url}`
      );
    }

    if (!parsedUrl.hostname || parsedUrl.hostname.length === 0) {
      throw new NetworkError(`${fieldName}のホスト名が無効です: ${url}`);
    }
  } catch (error) {
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError(`${fieldName}のURL形式が無効です: ${url}`);
  }
}

/**
 * チェーン設定の完全性検証
 * @param chain viemチェーン設定
 * @param chainId チェーンID
 * @throws NetworkError チェーン設定が不完全な場合
 */
function validateChainConfig(chain: Chain, chainId: number): void {
  if (!chain) {
    throw new NetworkError(`チェーンID ${chainId} のチェーン設定が存在しません`);
  }

  if (!chain.id || typeof chain.id !== 'number') {
    throw new NetworkError(`チェーンID ${chainId} のchain.idが無効です`);
  }

  if (chain.id !== chainId) {
    throw new NetworkError(`チェーンID不整合: 指定値=${chainId}, chain.id=${chain.id}`);
  }

  if (!chain.name || typeof chain.name !== 'string' || chain.name.trim().length === 0) {
    throw new NetworkError(`チェーンID ${chainId} のchain.nameが無効です`);
  }

  if (!chain.nativeCurrency || !chain.nativeCurrency.name || !chain.nativeCurrency.symbol) {
    throw new NetworkError(`チェーンID ${chainId} のnativeCurrency設定が不完全です`);
  }
}

/**
 * ネットワーク設定の完全性検証
 * @param config 検証対象の設定
 * @param chainId チェーンID
 * @throws NetworkError 設定が不完全または不正な場合
 */
function validateNetworkConfig(config: NetworkConfig, chainId: number): void {
  if (!config || typeof config !== 'object') {
    throw new NetworkError(`チェーンID ${chainId} の設定が存在しません`);
  }

  if (!config.name || typeof config.name !== 'string' || config.name.trim().length === 0) {
    throw new NetworkError(`チェーンID ${chainId} のネットワーク名が無効です`);
  }

  validateUrl(config.explorerBaseUrl, `チェーンID ${chainId} のエクスプローラーURL`);
  validateChainConfig(config.chain, chainId);
}

/**
 * チェーンIDの基本検証
 * @param chainId 検証対象のチェーンID
 * @throws NetworkError 不正なチェーンIDの場合
 */
function validateChainId(chainId: number): void {
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new NetworkError(`不正なチェーンID: ${chainId}`);
  }
}

/**
 * ビルトインネットワーク設定の取得
 * @param chainId チェーンID
 * @returns ネットワーク設定（存在しない場合はundefined）
 */
function getBuiltinNetworkConfig(chainId: number): NetworkConfig | undefined {
  // Anvilの場合は動的設定を返す
  if (chainId === 31337) {
    return createAnvilNetworkConfig();
  }

  return (BUILTIN_NETWORK_CONFIGS as Record<number, NetworkConfig>)[chainId];
}

/**
 * 新規ネットワーク設定の検証
 * @param override 新規設定
 * @param chainId チェーンID
 * @throws NetworkError 設定が不完全な場合
 */
function validateNewNetworkConfig(override: Partial<NetworkConfig>, chainId: number): void {
  if (!override.explorerBaseUrl || !override.name || !override.chain) {
    throw new NetworkError(
      `新規チェーンID ${chainId} には explorerBaseUrl, name, chain の全てが必要です`
    );
  }
}

/**
 * 既存設定の部分上書き処理
 * @param baseConfig 基本設定
 * @param override 上書き設定
 * @param chainId チェーンID
 * @returns マージされた設定
 */
function mergeExistingConfig(
  baseConfig: NetworkConfig,
  override: Partial<NetworkConfig>,
  chainId: number
): NetworkConfig {
  const mergedConfig = { ...baseConfig, ...override } as NetworkConfig;
  validateNetworkConfig(mergedConfig, chainId);
  return mergedConfig;
}

/**
 * 新規設定の追加処理
 * @param override 新規設定
 * @param chainId チェーンID
 * @returns 検証済み新規設定
 */
function addNewConfig(override: Partial<NetworkConfig>, chainId: number): NetworkConfig {
  validateNewNetworkConfig(override, chainId);
  const newConfig = override as NetworkConfig;
  validateNetworkConfig(newConfig, chainId);
  return newConfig;
}

/**
 * ネットワーク設定の堅牢なマージ
 * @param overrides 上書き設定
 * @returns 安全にマージされた設定
 * @throws NetworkError 設定が不正な場合
 */
function mergeNetworkConfigs(overrides: NetworkConfigOverrides): Record<number, NetworkConfig> {
  const result: Record<number, NetworkConfig> = { ...BUILTIN_NETWORK_CONFIGS };

  // Anvilを動的に追加
  result[31337] = createAnvilNetworkConfig();

  for (const [chainIdStr, override] of Object.entries(overrides)) {
    const chainId = Number(chainIdStr);
    validateChainId(chainId);

    if (!override || typeof override !== 'object') {
      continue;
    }

    const baseConfig = getBuiltinNetworkConfig(chainId);
    result[chainId] = baseConfig
      ? mergeExistingConfig(baseConfig, override, chainId)
      : addNewConfig(override, chainId);
  }

  return result;
}

/**
 * ネットワーク設定の取得と検証（型安全版）
 * @param chainId ビルトインチェーンID
 * @param customNetworkConfigs カスタムネットワーク設定
 * @returns 検証済みのネットワーク設定（必ず存在することが保証される）
 */
export function getNetworkConfig(
  chainId: BuiltinChainId,
  customNetworkConfigs?: NetworkConfigOverrides
): NetworkConfig;

/**
 * ネットワーク設定の取得と検証（動的版）
 * @param chainId 任意のチェーンID
 * @param customNetworkConfigs カスタムネットワーク設定
 * @returns 検証済みのネットワーク設定
 * @throws NetworkError 設定が存在しないか不完全な場合
 */
export function getNetworkConfig(
  chainId: number,
  customNetworkConfigs?: NetworkConfigOverrides
): NetworkConfig;

/**
 * ネットワーク設定の取得と検証（実装）
 * @param chainId チェーンID
 * @param customNetworkConfigs カスタムネットワーク設定
 * @returns 検証済みのネットワーク設定
 * @throws NetworkError 設定が存在しないか不完全な場合
 */
export function getNetworkConfig(
  chainId: number,
  customNetworkConfigs?: NetworkConfigOverrides
): NetworkConfig {
  validateChainId(chainId);

  const configs = customNetworkConfigs
    ? mergeNetworkConfigs(customNetworkConfigs)
    : (() => {
        const result: Record<number, NetworkConfig> = { ...BUILTIN_NETWORK_CONFIGS };
        // Anvilを動的に追加
        result[31337] = createAnvilNetworkConfig();
        return result;
      })();

  const config = configs[chainId];
  if (!config) {
    throw new NetworkError(`サポートされていないチェーンID: ${chainId}`);
  }

  validateNetworkConfig(config, chainId);
  return config;
}

/**
 * サポートされている全ネットワークの取得
 * @returns サポートネットワークのリスト
 */
export function getAllSupportedNetworks(): Array<{ chainId: number; config: NetworkConfig }> {
  const networks: Array<{ chainId: number; config: NetworkConfig }> = Object.entries(BUILTIN_NETWORK_CONFIGS).map(([chainId, config]) => {
    return {
      chainId: Number(chainId),
      config: config as NetworkConfig,
    };
  });

  // Anvilを動的に追加
  networks.push({
    chainId: 31337,
    config: createAnvilNetworkConfig(),
  });

  return networks;
}
