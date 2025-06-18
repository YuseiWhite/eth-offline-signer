import type { Chain } from 'viem';
import { hoodi, sepolia } from 'viem/chains';

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

/**　s
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
