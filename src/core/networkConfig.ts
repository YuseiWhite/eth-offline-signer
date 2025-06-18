import type { Chain } from 'viem';
import { hoodi, sepolia } from 'viem/chains';
import { NetworkError } from '../utils/errors';

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
