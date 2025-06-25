import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sepolia, hoodi } from 'viem/chains';
import {
  getNetworkConfig,
  getAllSupportedNetworks,
  getDisplayNetworkInfo,
  isBuiltinChainId,
  type NetworkConfigOverrides,
} from '../../../src/core/networkConfig';
import { NetworkError } from '../../../src/utils/errors';

// biome-disable-file lint/suspicious/noExplicitAny
describe('networkConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANVIL_RPC_URL = undefined as any;
    process.env.DOCKER_CONTAINER = undefined as any;
    process.env.HOSTNAME = undefined as any;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('isBuiltinChainId', () => {
    it('Sepoliaチェーン(11155111)がビルトインチェーンとして認識される', () => {
      expect(isBuiltinChainId(11155111)).toBe(true);
    });

    it('Hoodiチェーン(560048)がビルトインチェーンとして認識される', () => {
      expect(isBuiltinChainId(560048)).toBe(true);
    });

    it('Anvilチェーン(31337)がビルトインチェーンとして認識されない', () => {
      expect(isBuiltinChainId(31337)).toBe(false);
    });

    it('未知のチェーンIDがビルトインチェーンとして認識されない', () => {
      expect(isBuiltinChainId(999999)).toBe(false);
      expect(isBuiltinChainId(1)).toBe(false);
      expect(isBuiltinChainId(137)).toBe(false);
    });

    it('負の数値が適切に処理される', () => {
      expect(isBuiltinChainId(-1)).toBe(false);
    });

    it('ゼロが適切に処理される', () => {
      expect(isBuiltinChainId(0)).toBe(false);
    });
  });

  describe('getNetworkConfig - ビルトインネットワーク', () => {
    it('Sepoliaネットワーク設定を正常に取得', () => {
      const config = getNetworkConfig(11155111);

      expect(config.name).toBe('Sepolia Testnet');
      expect(config.explorerBaseUrl).toBe('https://sepolia.etherscan.io');
      expect(config.chain).toEqual(sepolia);
      expect(config.chain.id).toBe(11155111);
    });

    it('Hoodiネットワーク設定を正常に取得', () => {
      const config = getNetworkConfig(560048);

      expect(config.name).toBe('Hoodi Testnet');
      expect(config.explorerBaseUrl).toBe('https://hoodi.etherscan.io');
      expect(config.chain).toEqual(hoodi);
      expect(config.chain.id).toBe(560048);
    });
  });

  describe('getNetworkConfig - Anvilネットワーク', () => {
    it('環境変数なしの場合、デフォルトのAnvil設定を取得', () => {
      const config = getNetworkConfig(31337);

      expect(config.name).toBe('Anvil Local Network');
      expect(config.explorerBaseUrl).toBe('http://localhost:8545');
      expect(config.chain.id).toBe(31337);
      expect(config.chain.rpcUrls.default.http).toEqual(['http://localhost:8545']);
      expect(config.chain.testnet).toBe(true);
    });

    it('ANVIL_RPC_URL環境変数が設定されている場合', () => {
      process.env.ANVIL_RPC_URL = 'http://custom-anvil:8545';

      const config = getNetworkConfig(31337);

      expect(config.explorerBaseUrl).toBe('http://custom-anvil:8545');
      expect(config.chain.rpcUrls.default.http).toEqual(['http://custom-anvil:8545']);
    });

    it('Docker環境の場合（DOCKER_CONTAINER環境変数）', () => {
      process.env.ANVIL_RPC_URL = undefined;
      process.env.DOCKER_CONTAINER = 'true';

      const config = getNetworkConfig(31337);

      expect(config.explorerBaseUrl).toBe('http://anvil:8545');
      expect(config.chain.rpcUrls.default.http).toEqual(['http://anvil:8545']);
    });

    it('Docker環境の場合（HOSTNAME環境変数）', () => {
      process.env.ANVIL_RPC_URL = undefined;
      process.env.DOCKER_CONTAINER = undefined;
      process.env.HOSTNAME = 'docker-container-123';

      const config = getNetworkConfig(31337);

      expect(config.explorerBaseUrl).toBe('http://anvil:8545');
      expect(config.chain.rpcUrls.default.http).toEqual(['http://anvil:8545']);
    });

    it('ANVIL_RPC_URLが最優先される（Docker環境でも）', () => {
      process.env.ANVIL_RPC_URL = 'http://priority-anvil:8545';
      process.env.DOCKER_CONTAINER = 'true';
      process.env.HOSTNAME = 'docker-container';

      const config = getNetworkConfig(31337);

      expect(config.explorerBaseUrl).toBe('http://priority-anvil:8545');
      expect(config.chain.rpcUrls.default.http).toEqual(['http://priority-anvil:8545']);
    });
  });

  describe('getNetworkConfig - カスタムネットワーク設定', () => {
    it('カスタム設定でビルトインネットワークをオーバーライド', () => {
      const customConfigs: NetworkConfigOverrides = {
        11155111: {
          name: 'Custom Sepolia',
          explorerBaseUrl: 'https://custom-sepolia.etherscan.io/tx/',
          chain: {
            id: 11155111,
            name: 'Custom Sepolia',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: {
              default: { http: ['https://sepolia.infura.io/v3/custom'] },
            },
          },
        },
      };

      const config = getNetworkConfig(11155111, customConfigs);

      expect(config.explorerBaseUrl).toBe('https://custom-sepolia.etherscan.io/tx/');
      expect(config.name).toBe('Custom Sepolia');
    });

    it('新しいカスタムネットワークを追加', () => {
      const customConfigs: NetworkConfigOverrides = {
        999999: {
          name: 'Custom Network',
          explorerBaseUrl: 'https://custom-explorer.com',
          chain: {
            id: 999999,
            name: 'Custom Chain',
            nativeCurrency: { name: 'Custom Token', symbol: 'CTK', decimals: 18 },
            rpcUrls: {
              default: { http: ['https://custom-rpc.com'] },
            },
          },
        },
      };

      const config = getNetworkConfig(999999, customConfigs);

      expect(config.name).toBe('Custom Network');
      expect(config.explorerBaseUrl).toBe('https://custom-explorer.com');
      expect(config.chain.id).toBe(999999);
      expect(config.chain.name).toBe('Custom Chain');
    });

    it('部分的なカスタム設定でビルトインネットワークをマージ', () => {
      const customConfigs: NetworkConfigOverrides = {
        11155111: {
          explorerBaseUrl: 'https://alternative-sepolia-explorer.com',
          // nameは指定しない（ビルトインの値を使用）
          chain: {
            id: 11155111,
            name: 'Sepolia Testnet',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: {
              default: { http: ['https://sepolia.infura.io/v3/custom'] },
            },
          },
        },
      };

      const config = getNetworkConfig(11155111, customConfigs);

      expect(config.name).toBe('Sepolia Testnet'); // ビルトインの値
      expect(config.explorerBaseUrl).toBe('https://alternative-sepolia-explorer.com'); // カスタム値
      expect(config.chain.id).toBe(11155111); // カスタム値を使用
    });
  });

  describe('getNetworkConfig - エラーハンドリング', () => {
    it('無効なチェーンIDでNetworkErrorをスロー', () => {
      expect(() => getNetworkConfig(-1)).toThrow(NetworkError);
      expect(() => getNetworkConfig(-1)).toThrow('不正なチェーンID: -1');
    });

    it('ゼロのチェーンIDでNetworkErrorをスロー', () => {
      expect(() => getNetworkConfig(0)).toThrow(NetworkError);
      expect(() => getNetworkConfig(0)).toThrow('不正なチェーンID: 0');
    });

    it('小数点のチェーンIDでNetworkErrorをスロー', () => {
      expect(() => getNetworkConfig(1.5 as unknown as number)).toThrow(NetworkError);
      expect(() => getNetworkConfig(1.5 as unknown as number)).toThrow('不正なチェーンID: 1.5');
    });

    it('未知のチェーンIDでNetworkErrorをスロー', () => {
      expect(() => getNetworkConfig(123456)).toThrow(NetworkError);
      expect(() => getNetworkConfig(123456)).toThrow('未サポートのチェーンID: 123456');
    });

    it('不完全なカスタム設定でNetworkErrorをスロー', () => {
      const invalidCustomConfigs: NetworkConfigOverrides = {
        999999: {
          name: 'Incomplete Network',
          // explorerBaseUrlが不足
        },
      };

      expect(() => getNetworkConfig(999999, invalidCustomConfigs)).toThrow(NetworkError);
      expect(() => getNetworkConfig(999999, invalidCustomConfigs)).toThrow(
        '新規ネットワーク設定にはchain設定が必要です'
      );
    });

    it('無効なURLを含むカスタム設定でNetworkErrorをスロー', () => {
      const invalidCustomConfigs: NetworkConfigOverrides = {
        999999: {
          name: 'Invalid URL Network',
          explorerBaseUrl: '', // 空文字でzodバリデーションに失敗させる
          chain: {
            id: 999999,
            name: 'Invalid Chain',
            nativeCurrency: { name: 'Token', symbol: 'TKN', decimals: 18 },
            rpcUrls: {
              default: { http: ['https://valid-rpc.com'] },
            },
          },
        },
      };

      expect(() => getNetworkConfig(999999, invalidCustomConfigs)).toThrow(NetworkError);
      expect(() => getNetworkConfig(999999, invalidCustomConfigs)).toThrow(
        '新規ネットワーク設定にはexplorerBaseUrl設定が必要です'
      );
    });

    it('チェーンID不整合のカスタム設定でNetworkErrorをスロー', () => {
      const invalidCustomConfigs: NetworkConfigOverrides = {
        999999: {
          name: 'Mismatched Chain',
          explorerBaseUrl: 'https://valid-explorer.com',
          chain: {
            id: 888888, // 異なるチェーンID
            name: 'Mismatched Chain',
            nativeCurrency: { name: 'Token', symbol: 'TKN', decimals: 18 },
            rpcUrls: {
              default: { http: ['https://valid-rpc.com'] },
            },
          },
        },
      };

      expect(() => getNetworkConfig(999999, invalidCustomConfigs)).toThrow(NetworkError);
      expect(() => getNetworkConfig(999999, invalidCustomConfigs)).toThrow(
        'チェーン設定のIDが一致しません'
      );
    });
  });

  describe('getAllSupportedNetworks', () => {
    it('ビルトインネットワークのリストを正常に取得', () => {
      const networks = getAllSupportedNetworks();

      expect(networks).toHaveLength(3); // Sepolia, Hoodi, Anvil

      const sepoliaNetwork = networks.find((n) => n.chainId === 11155111);
      expect(sepoliaNetwork).toBeDefined();
      expect(sepoliaNetwork?.config.name).toBe('Sepolia Testnet');

      const hoodiNetwork = networks.find((n) => n.chainId === 560048);
      expect(hoodiNetwork).toBeDefined();
      expect(hoodiNetwork?.config.name).toBe('Hoodi Testnet');
    });

    it('ネットワークリストの構造が正しい', () => {
      const networks = getAllSupportedNetworks();

      for (const network of networks) {
        expect(typeof network.chainId).toBe('number');
        expect(network.chainId).toBeGreaterThan(0);
        expect(network.config).toBeDefined();
        expect(typeof network.config.name).toBe('string');
        expect(typeof network.config.explorerBaseUrl).toBe('string');
        expect(network.config.chain).toBeDefined();
        expect(network.config.chain.id).toBe(network.chainId);
      }
    });

    it('should include Sepolia, Hoodi, and Anvil networks', () => {
      const networks = getAllSupportedNetworks();
      const chainIds = networks.map((n) => n.chainId);
      expect(chainIds).toContain(11155111);
      expect(chainIds).toContain(560048);
      expect(chainIds).toContain(31337);
      expect(chainIds.length).toBe(3);
      for (const n of networks) {
        expect(n.config).toBeDefined();
      }
    });
  });

  describe('getDisplayNetworkInfo', () => {
    it('Sepoliaネットワークの表示情報を正常に取得', () => {
      const info = getDisplayNetworkInfo(11155111);

      expect(info.name).toBe('Sepolia Testnet');
      expect(info.explorer).toBe('https://sepolia.etherscan.io');
      expect(info.type).toBe('testnet');
    });

    it('Hoodiネットワークの表示情報を正常に取得', () => {
      const info = getDisplayNetworkInfo(560048);

      expect(info.name).toBe('Hoodi Testnet');
      expect(info.explorer).toBe('https://hoodi.etherscan.io');
      expect(info.type).toBe('testnet');
    });

    it('Anvilネットワークの表示情報を正常に取得', () => {
      const info = getDisplayNetworkInfo(31337);

      expect(info.name).toBe('Anvil Local Network');
      expect(info.explorer).toBe('http://localhost:8545');
      expect(info.type).toBe('testnet');
    });

    it('カスタムネットワークのタイプが正しく判定される', () => {
      // getDisplayNetworkInfoは内部的にgetNetworkConfigを使用するため、
      // カスタム設定を直接渡すことはできないが、タイプ判定のロジックをテスト
      const info = getDisplayNetworkInfo(999999);
      expect(info.type).toBe('custom'); // 未知のチェーンIDはcustomタイプ
    });

    it('無効なチェーンIDで適切に処理', () => {
      // getDisplayNetworkInfoはエラーをキャッチしてUnknownを返す
      const result1 = getDisplayNetworkInfo(-1);
      expect(result1.name).toContain('Unknown Network');
      expect(result1.type).toBe('custom');

      const result2 = getDisplayNetworkInfo(0);
      expect(result2.name).toContain('Unknown Network');
      expect(result2.type).toBe('custom');
    });
  });

  describe('エッジケース', () => {
    it('非常に大きなチェーンIDを処理', () => {
      expect(() => getNetworkConfig(Number.MAX_SAFE_INTEGER)).toThrow(NetworkError);
      expect(() => getNetworkConfig(Number.MAX_SAFE_INTEGER)).toThrow('未サポートのチェーンID');
    });

    it('複数のカスタム設定を同時に処理', () => {
      const multipleCustomConfigs: NetworkConfigOverrides = {
        11155111: {
          explorerBaseUrl: 'https://custom-sepolia.com',
        },
        560048: {
          name: 'Modified Hoodi',
        },
        999999: {
          name: 'New Custom Network',
          explorerBaseUrl: 'https://new-custom.com',
          chain: {
            id: 999999,
            name: 'New Custom Chain',
            nativeCurrency: { name: 'Token', symbol: 'TKN', decimals: 18 },
            rpcUrls: {
              default: { http: ['https://new-custom-rpc.com'] },
            },
          },
        },
      };

      const sepoliaConfig = getNetworkConfig(11155111, multipleCustomConfigs);
      expect(sepoliaConfig.explorerBaseUrl).toBe('https://custom-sepolia.com');
      expect(sepoliaConfig.name).toBe('Sepolia Testnet'); // 変更されていない

      const hoodiConfig = getNetworkConfig(560048, multipleCustomConfigs);
      expect(hoodiConfig.name).toBe('Modified Hoodi');
      expect(hoodiConfig.explorerBaseUrl).toBe('https://hoodi.etherscan.io'); // 変更されていない

      const customConfig = getNetworkConfig(999999, multipleCustomConfigs);
      expect(customConfig.name).toBe('New Custom Network');
      expect(customConfig.explorerBaseUrl).toBe('https://new-custom.com');
    });

    it('空のカスタム設定オブジェクトを処理', () => {
      const emptyCustomConfigs: NetworkConfigOverrides = {};

      const config = getNetworkConfig(11155111, emptyCustomConfigs);
      expect(config.name).toBe('Sepolia Testnet');
      expect(config.explorerBaseUrl).toBe('https://sepolia.etherscan.io');
    });
  });

  describe('URL検証', () => {
    it('有効なHTTPSのURLを受け入れる', () => {
      const customConfigs: NetworkConfigOverrides = {
        999999: {
          name: 'HTTPS Network',
          explorerBaseUrl: 'https://valid-explorer.com',
          chain: {
            id: 999999,
            name: 'HTTPS Chain',
            nativeCurrency: { name: 'Token', symbol: 'TKN', decimals: 18 },
            rpcUrls: {
              default: { http: ['https://valid-rpc.com'] },
            },
          },
        },
      };

      expect(() => getNetworkConfig(999999, customConfigs)).not.toThrow();
    });

    it('有効なHTTPのURLを受け入れる', () => {
      const customConfigs: NetworkConfigOverrides = {
        999999: {
          name: 'HTTP Network',
          explorerBaseUrl: 'http://valid-explorer.com',
          chain: {
            id: 999999,
            name: 'HTTP Chain',
            nativeCurrency: { name: 'Token', symbol: 'TKN', decimals: 18 },
            rpcUrls: {
              default: { http: ['http://valid-rpc.com'] },
            },
          },
        },
      };

      expect(() => getNetworkConfig(999999, customConfigs)).not.toThrow();
    });

    it('無効なプロトコルのURLを拒否', () => {
      const customConfigs: NetworkConfigOverrides = {
        999999: {
          name: 'Invalid Protocol Network',
          explorerBaseUrl: 'https://valid-explorer.com',
          chain: {
            id: 999999,
            name: 'Invalid Protocol Chain',
            nativeCurrency: { name: 'Token', symbol: 'TKN', decimals: 18 },
            rpcUrls: {
              default: { http: ['not-a-url'] }, // 無効なURLでzodバリデーションに失敗させる
            },
          },
        },
      };

      expect(() => getNetworkConfig(999999, customConfigs)).toThrow(NetworkError);
      expect(() => getNetworkConfig(999999, customConfigs)).toThrow('ネットワーク設定が無効です');
    });

    it('空のURLを拒否', () => {
      const customConfigs: NetworkConfigOverrides = {
        999999: {
          name: 'Empty URL Network',
          explorerBaseUrl: '',
          chain: {
            id: 999999,
            name: 'Empty Chain',
            nativeCurrency: { name: 'Token', symbol: 'TKN', decimals: 18 },
            rpcUrls: {
              default: { http: ['https://valid-rpc.com'] },
            },
          },
        },
      };

      expect(() => getNetworkConfig(999999, customConfigs)).toThrow(NetworkError);
      expect(() => getNetworkConfig(999999, customConfigs)).toThrow(
        '新規ネットワーク設定にはexplorerBaseUrl設定が必要です'
      );
    });
  });

  describe('Anvil RPC URL via getNetworkConfig', () => {
    it('throws NetworkError on invalid ANVIL_RPC_URL', () => {
      process.env.ANVIL_RPC_URL = 'not-a-url';
      expect(() => getNetworkConfig(31337)).toThrow(NetworkError);
      expect(() => getNetworkConfig(31337)).toThrow(/ANVIL_RPC_URL環境変数のURL形式が無効です/);
    });

    it('returns config with env URL when ANVIL_RPC_URL is valid', () => {
      process.env.ANVIL_RPC_URL = 'http://example.com:8545';
      const cfg = getNetworkConfig(31337);
      expect(cfg.explorerBaseUrl).toBe('http://example.com:8545');
      expect(cfg.chain.rpcUrls.default.http).toEqual(['http://example.com:8545']);
    });

    it('returns docker URL when DOCKER_CONTAINER is set', () => {
      process.env.DOCKER_CONTAINER = 'true';
      const cfg = getNetworkConfig(31337);
      expect(cfg.explorerBaseUrl).toBe('http://anvil:8545');
      expect(cfg.chain.rpcUrls.default.http).toEqual(['http://anvil:8545']);
    });

    it('returns localhost URL by default', () => {
      const cfg = getNetworkConfig(31337);
      expect(cfg.explorerBaseUrl).toBe('http://localhost:8545');
      expect(cfg.chain.rpcUrls.default.http).toEqual(['http://localhost:8545']);
    });
  });

  describe('getDisplayNetworkInfo', () => {
    it('returns correct info for built-in Sepolia', () => {
      const info = getDisplayNetworkInfo(sepolia.id);
      expect(info).toEqual({
        name: 'Sepolia Testnet',
        explorer: 'https://sepolia.etherscan.io',
        type: 'testnet',
      });
    });

    it('returns Anvil info for chain id 31337', () => {
      const info = getDisplayNetworkInfo(31337);
      expect(info.name).toBe('Anvil Local Network');
      expect(info.explorer).toMatch(/^http/);
      expect(info.type).toBe('testnet');
    });

    it('returns Unknown info for unsupported chain', () => {
      const info = getDisplayNetworkInfo(42);
      expect(info).toEqual({
        name: 'Unknown Network (42)',
        explorer: 'N/A',
        type: 'custom',
      });
    });
  });
});

describe('networkConfig internal errors', () => {
  it('throws when adding custom network without name', () => {
    const overrides = {
      1234: {
        // name missing
        explorerBaseUrl: 'https://explorer.example.com',
        chain: {
          id: 1234,
          name: 'Chain',
          nativeCurrency: { name: 'Token', symbol: 'T', decimals: 18 },
          rpcUrls: { default: { http: ['https://rpc.example.com'] } },
        },
      },
    };
    expect(() => getNetworkConfig(1234, overrides)).toThrow(NetworkError);
    expect(() => getNetworkConfig(1234, overrides)).toThrow(
      /新規ネットワーク設定にはname設定が必要です/
    );
  });

  it('throws on unsupported chainId', () => {
    const invalidId = 5555;
    expect(() => getNetworkConfig(invalidId)).toThrow(NetworkError);
    expect(() => getNetworkConfig(invalidId)).toThrow(
      new RegExp(`未サポートのチェーンID: ${invalidId}`)
    );
  });
});
