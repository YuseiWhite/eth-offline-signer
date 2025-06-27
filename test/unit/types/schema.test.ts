import { describe, expect, it, vi } from 'vitest';
import {
  validateEIP1559TxParams,
  validateNetworkConfig,
  validateCliOptions,
  validateTransactionProcessorOptions,
  validateNonceRetryOptions,
  validateNonceError,
  EthereumAddressSchema,
  NumericStringSchema,
  AccessListItemSchema,
  EIP1559TxParamsSchema,

  TransactionHashSchema,
  RawPrivateKeySchema,
  FilePathSchema,
  PrivateKeyFormatSchema,
  RpcUrlSchema,
  ChainIdSchema,
  NativeCurrencySchema,
  SignedTransactionSchema,
  ErrorObjectSchema,
  ErrorStringSchema,
  PackageJsonSchema,
  LoggerSchema,
  ExecuteTransactionResultSchema,
  ChainConfigSchema,
  NetworkConfigSchema,
} from '../../../src/types/schema';

describe('Schema Validation', () => {
  describe('EthereumAddressSchema', () => {
    it('should validate correct Ethereum address', () => {
      const validAddress = '0x742d35cc6633c0532925a3b8d5c0e1985b0f8e7f';
      const result = EthereumAddressSchema.safeParse(validAddress);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(validAddress);
      }
    });

    it('should reject address without 0x prefix', () => {
      const invalidAddress = '742d35cc6633c0532925a3b8d5c0e1985b0f8e7f';
      const result = EthereumAddressSchema.safeParse(invalidAddress);
      expect(result.success).toBe(false);
    });

    it('should reject address with wrong length', () => {
      const shortAddress = '0x742d35cc6633c0532925a3b8d5c0e1985b0f8e';
      const result = EthereumAddressSchema.safeParse(shortAddress);
      expect(result.success).toBe(false);
    });

    it('should reject address with invalid hex characters', () => {
      const invalidAddress = '0x742d35cc6633c0532925a3b8d5c0e1985b0f8eZZ';
      const result = EthereumAddressSchema.safeParse(invalidAddress);
      expect(result.success).toBe(false);
    });

    it('should accept both uppercase and lowercase hex', () => {
      const upperCaseAddress = '0x742D35CC6633C0532925A3B8D5C0E1985B0F8E7F';
      const result = EthereumAddressSchema.safeParse(upperCaseAddress);
      expect(result.success).toBe(true);
    });
  });

  describe('NumericStringSchema', () => {
    it('should validate numeric string', () => {
      const numericString = '1000000000000000000';
      const result = NumericStringSchema.safeParse(numericString);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(numericString);
      }
    });

    it('should reject string with non-numeric characters', () => {
      const invalidString = '1000000000000000000a';
      const result = NumericStringSchema.safeParse(invalidString);
      expect(result.success).toBe(false);
    });

    it('should reject negative numbers', () => {
      const negativeString = '-1000';
      const result = NumericStringSchema.safeParse(negativeString);
      expect(result.success).toBe(false);
    });

    it('should reject decimal numbers', () => {
      const decimalString = '1000.5';
      const result = NumericStringSchema.safeParse(decimalString);
      expect(result.success).toBe(false);
    });

    it('should accept zero', () => {
      const zeroString = '0';
      const result = NumericStringSchema.safeParse(zeroString);
      expect(result.success).toBe(true);
    });
  });

  describe('AccessListItemSchema', () => {
    it('should validate correct access list item', () => {
      const accessListItem = {
        address: '0x742d35cc6633c0532925a3b8d5c0e1985b0f8e7f',
        storageKeys: [
          '0x0000000000000000000000000000000000000000000000000000000000000001',
          '0x0000000000000000000000000000000000000000000000000000000000000002',
        ],
      };
      const result = AccessListItemSchema.safeParse(accessListItem);
      expect(result.success).toBe(true);
    });

    it('should reject invalid address in access list', () => {
      const accessListItem = {
        address: 'invalid-address',
        storageKeys: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
      };
      const result = AccessListItemSchema.safeParse(accessListItem);
      expect(result.success).toBe(false);
    });

    it('should reject invalid storage key format', () => {
      const accessListItem = {
        address: '0x742d35cc6633c0532925a3b8d5c0e1985b0f8e7f',
        storageKeys: ['0x01'], // Too short
      };
      const result = AccessListItemSchema.safeParse(accessListItem);
      expect(result.success).toBe(false);
    });

    it('should accept empty storage keys array', () => {
      const accessListItem = {
        address: '0x742d35cc6633c0532925a3b8d5c0e1985b0f8e7f',
        storageKeys: [],
      };
      const result = AccessListItemSchema.safeParse(accessListItem);
      expect(result.success).toBe(true);
    });
  });

  describe('validateEIP1559TxParams', () => {
    const validParams = {
      to: '0x742d35cc6633c0532925a3b8d5c0e1985b0f8e7f',
      value: '1000000000000000000',
      chainId: 1,
      nonce: 1,
      gasLimit: '21000',
      maxFeePerGas: '30000000000',
      maxPriorityFeePerGas: '2000000000',
    };

    it('should validate correct EIP-1559 parameters', () => {
      const result = validateEIP1559TxParams(validParams);
      expect(result).toEqual(validParams);
    });

    it('should validate parameters with access list', () => {
      const paramsWithAccessList = {
        ...validParams,
        accessList: [
          {
            address: '0x742d35cc6633c0532925a3b8d5c0e1985b0f8e7f',
            storageKeys: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
          },
        ],
      };
      const result = validateEIP1559TxParams(paramsWithAccessList);
      expect(result).toEqual(paramsWithAccessList);
    });

    it('should throw Error for invalid to address', () => {
      const invalidParams = { ...validParams, to: 'invalid-address' };
      expect(() => validateEIP1559TxParams(invalidParams)).toThrow(Error);
      expect(() => validateEIP1559TxParams(invalidParams)).toThrow(/無効なEthereumアドレス形式/);
    });

    it('should throw Error for invalid value', () => {
      const invalidParams = { ...validParams, value: 'invalid-value' };
      expect(() => validateEIP1559TxParams(invalidParams)).toThrow(Error);
      expect(() => validateEIP1559TxParams(invalidParams)).toThrow(/無効な数値文字列/);
    });

    it('should throw Error for invalid chainId', () => {
      const invalidParams = { ...validParams, chainId: -1 };
      expect(() => validateEIP1559TxParams(invalidParams)).toThrow(Error);
      expect(() => validateEIP1559TxParams(invalidParams)).toThrow(/chainIdは正の整数/);
    });

    it('should throw Error for invalid nonce', () => {
      const invalidParams = { ...validParams, nonce: -1 };
      expect(() => validateEIP1559TxParams(invalidParams)).toThrow(Error);
      expect(() => validateEIP1559TxParams(invalidParams)).toThrow(/nonceは0以上の整数/);
    });

    it('should throw Error for missing required field', () => {
      const { to, ...incompleteParams } = validParams;
      expect(() => validateEIP1559TxParams(incompleteParams)).toThrow(Error);
    });

    it('should throw Error for extra fields (strict mode)', () => {
      const paramsWithExtra = { ...validParams, extraField: 'should-not-be-here' };
      expect(() => validateEIP1559TxParams(paramsWithExtra)).toThrow(Error);
      expect(() => validateEIP1559TxParams(paramsWithExtra)).toThrow(/許可されていないフィールド/);
    });

    it('should throw Error for null input', () => {
      expect(() => validateEIP1559TxParams(null)).toThrow(Error);
    });

    it('should throw Error for undefined input', () => {
      expect(() => validateEIP1559TxParams(undefined)).toThrow(Error);
    });

    it('should throw Error for non-object input', () => {
      expect(() => validateEIP1559TxParams('invalid')).toThrow(Error);
      expect(() => validateEIP1559TxParams(123)).toThrow(Error);
    });

    it('should provide detailed error messages for multiple validation errors', () => {
      const invalidParams = {
        to: 'invalid-address',
        value: 'invalid-value',
        chainId: -1,
        nonce: -1,
        gasLimit: 'invalid-gas',
        maxFeePerGas: 'invalid-fee',
        maxPriorityFeePerGas: 'invalid-priority',
      };

      expect(() => validateEIP1559TxParams(invalidParams)).toThrow(Error);

      try {
        validateEIP1559TxParams(invalidParams);
      } catch (error) {
        if (error instanceof Error) {
          // ZodErrorの場合、エラーメッセージにバリデーション詳細が含まれる
          expect(error.message).toContain('無効なEthereumアドレス形式');
          expect(error.message).toContain('無効な数値文字列');
          expect(error.message).toContain('chainIdは正の整数');
          expect(error.message).toContain('nonceは0以上の整数');
        }
      }
    });

    it('should handle edge case: zero values', () => {
      const zeroParams = {
        ...validParams,
        value: '0',
        nonce: 0,
        gasLimit: '0',
        maxFeePerGas: '0',
        maxPriorityFeePerGas: '0',
      };
      const result = validateEIP1559TxParams(zeroParams);
      expect(result).toEqual(zeroParams);
    });

    it('should handle edge case: maximum chainId', () => {
      const maxChainIdParams = {
        ...validParams,
        chainId: Number.MAX_SAFE_INTEGER,
      };
      const result = validateEIP1559TxParams(maxChainIdParams);
      expect(result.chainId).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle edge case: very large numeric strings', () => {
      const largeValueParams = {
        ...validParams,
        value: '999999999999999999999999999999999999999999999999999999999999',
        gasLimit: '999999999999999999999999999999999999999999999999999999999999',
        maxFeePerGas: '999999999999999999999999999999999999999999999999999999999999',
        maxPriorityFeePerGas: '999999999999999999999999999999999999999999999999999999999999',
      };
      const result = validateEIP1559TxParams(largeValueParams);
      expect(result).toEqual(largeValueParams);
    });
  });
});

// internal schema tests merged from schema.internal.test.ts

import {
  PrivateKeySchema,
  CliOptionsSchema,
  TransactionProcessorOptionsSchema,
} from '../../../src/types/schema';

describe('Zod schema internal tests', () => {
  describe('EthereumAddressSchema internal', () => {
    it('accepts valid address', () => {
      expect(EthereumAddressSchema.parse('0x' + 'a'.repeat(40))).toBe('0x' + 'a'.repeat(40));
    });
    it('rejects missing 0x', () => {
      expect(() => EthereumAddressSchema.parse('a'.repeat(40))).toThrow();
    });
    it('rejects wrong length', () => {
      expect(() => EthereumAddressSchema.parse('0x' + 'a'.repeat(39))).toThrow();
    });
  });

  describe('NumericStringSchema internal', () => {
    it('accepts numeric string', () => {
      expect(NumericStringSchema.parse('123')).toBe('123');
    });
    it('rejects non-numeric string', () => {
      expect(() => NumericStringSchema.parse('12a3')).toThrow();
    });
    it('rejects empty string', () => {
      expect(() => NumericStringSchema.parse('')).toThrow();
    });
  });

  describe('PrivateKeySchema internal', () => {
    it('accepts valid private key', () => {
      expect(PrivateKeySchema.parse('0x' + 'f'.repeat(64))).toBe('0x' + 'f'.repeat(64));
    });
    it('rejects without 0x', () => {
      expect(() => PrivateKeySchema.parse('f'.repeat(64))).toThrow();
    });
    it('rejects short string', () => {
      expect(() => PrivateKeySchema.parse('0x' + 'f'.repeat(63))).toThrow();
    });
  });

  describe('AccessListItemSchema internal', () => {
    it('accepts valid item', () => {
      const item = {
        address: '0x' + 'a'.repeat(40),
        storageKeys: ['0x' + '0'.repeat(64)],
      };
      expect(AccessListItemSchema.parse(item)).toEqual(item);
    });
    it('rejects missing storageKeys', () => {
      const item: any = { address: '0x' + 'a'.repeat(40) };
      expect(() => AccessListItemSchema.parse(item)).toThrow();
    });
  });

  describe('CliOptionsSchema refine', () => {
    it('accepts broadcast false without rpcUrl', () => {
      const parsed = CliOptionsSchema.parse({ keyFile: 'a', params: 'b', broadcast: false });
      expect(parsed.broadcast).toBe(false);
    });
    it('accepts broadcast true with rpcUrl', () => {
      const parsed = CliOptionsSchema.parse({
        keyFile: 'x',
        params: 'y',
        broadcast: true,
        rpcUrl: 'https://ok',
      });
      expect(parsed.rpcUrl).toBe('https://ok');
    });
  });

  describe('TransactionProcessorOptionsSchema behavior', () => {
    it('strips unknown fields by default', () => {
      const input: any = {
        privateKey: '0x' + 'a'.repeat(64),
        txParams: {
          to: '0x' + 'a'.repeat(40),
          value: '1',
          chainId: 1,
          nonce: 0,
          gasLimit: '1',
          maxFeePerGas: '1',
          maxPriorityFeePerGas: '1',
        },
        extra: 'no',
      };
      const parsed = TransactionProcessorOptionsSchema.parse(input);
      expect(parsed).not.toHaveProperty('extra');
      expect(parsed).toHaveProperty('privateKey');
    });
  });

  describe('EIP1559TxParamsSchema strict', () => {
    it('parses valid params', () => {
      const params = {
        to: '0x' + 'b'.repeat(40),
        value: '0',
        chainId: 111,
        nonce: 0,
        gasLimit: '21000',
        maxFeePerGas: '200',
        maxPriorityFeePerGas: '100',
      };
      expect(EIP1559TxParamsSchema.parse(params)).toEqual(params);
    });
    it('rejects unknown fields', () => {
      const params: any = {
        to: '0x' + 'b'.repeat(40),
        value: '0',
        chainId: 111,
        nonce: 0,
        gasLimit: '21000',
        maxFeePerGas: '200',
        maxPriorityFeePerGas: '100',
        foo: 1,
      };
      expect(() => EIP1559TxParamsSchema.parse(params)).toThrow();
    });
  });
});

describe('schema validation', () => {
  describe('uncovered validation functions', () => {
    describe('validateNetworkConfig', () => {
      it('should validate valid network config', () => {
        const validConfig = {
          name: 'Ethereum Mainnet',
          explorerBaseUrl: 'https://etherscan.io/tx/',
          chain: {
            id: 1,
            name: 'Ethereum',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: { default: { http: ['https://mainnet.infura.io/v3/test'] } },
          },
        };

        const result = validateNetworkConfig(validConfig);
        expect(result.name).toBe(validConfig.name);
        expect(result.explorerBaseUrl).toBe(validConfig.explorerBaseUrl);
        expect(result.chain).toEqual(validConfig.chain);
      });

      it('should throw for invalid network config', () => {
        const invalidConfig = {
          name: 123, // Should be string
          explorerBaseUrl: '', // Should be non-empty
          chain: 'invalid', // Should be object
        };

        expect(() => validateNetworkConfig(invalidConfig)).toThrow();
      });
    });

    describe('validateTransactionProcessorOptions', () => {
      it('should validate sign-only options', () => {
        const signOnlyOptions = {
          privateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          txParams: {
            to: '0x742d35Cc6634C0532925a3b8D4C9db7C9C0C7A8A',
            value: '1000000000000000000',
            gasLimit: '21000',
            maxFeePerGas: '20000000000',
            maxPriorityFeePerGas: '1000000000',
            nonce: 10,
            chainId: 1,
          },
          broadcast: false,
        };

        const result = validateTransactionProcessorOptions(signOnlyOptions);
        expect(result.broadcast).toBe(false);
        expect(result.privateKey).toBe(signOnlyOptions.privateKey);
      });

      it('should validate broadcast options', () => {
        const broadcastOptions = {
          privateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          txParams: {
            to: '0x742d35Cc6634C0532925a3b8D4C9db7C9C0C7A8A',
            value: '1000000000000000000',
            gasLimit: '21000',
            maxFeePerGas: '20000000000',
            maxPriorityFeePerGas: '1000000000',
            nonce: 10,
            chainId: 1,
          },
          broadcast: true,
          rpcUrl: 'https://mainnet.infura.io/v3/test',
          maxRetries: 5,
        };

        const result = validateTransactionProcessorOptions(broadcastOptions);
        expect(result.broadcast).toBe(true);
        expect(result.rpcUrl).toBe(broadcastOptions.rpcUrl);
        expect(result.maxRetries).toBe(5);
      });

      it('should apply default maxRetries', () => {
        const optionsWithoutMaxRetries = {
          privateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          txParams: {
            to: '0x742d35Cc6634C0532925a3b8D4C9db7C9C0C7A8A',
            value: '1000000000000000000',
            gasLimit: '21000',
            maxFeePerGas: '20000000000',
            maxPriorityFeePerGas: '1000000000',
            nonce: 10,
            chainId: 1,
          },
          broadcast: false,
        };

        const result = validateTransactionProcessorOptions(optionsWithoutMaxRetries);
        expect(result.maxRetries).toBe(3); // Default value
      });

      it('should throw for invalid broadcast options', () => {
        const invalidOptions = {
          privateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          txParams: {
            to: '0x742d35Cc6634C0532925a3b8D4C9db7C9C0C7A8A',
            value: '1000000000000000000',
            gasLimit: '21000',
            maxFeePerGas: '20000000000',
            maxPriorityFeePerGas: '1000000000',
            nonce: 10,
            chainId: 1,
          },
          broadcast: false,
          rpcUrl: 'https://mainnet.infura.io/v3/test', // broadcastがfalseの場合、rpcUrlは提供してはいけない
        };

        expect(() => validateTransactionProcessorOptions(invalidOptions)).toThrow();
      });
    });

    describe('validateNonceRetryOptions', () => {
      it('should validate valid nonce retry options', () => {
        const validOptions = {
          maxRetries: 3,
          executeTransaction: vi.fn().mockResolvedValue({
            transactionHash: '0x123',
          }),
          txParams: {
            to: '0x742d35Cc6634C0532925a3b8D4C9db7C9C0C7A8A',
            value: '1000000000000000000',
            gasLimit: '21000',
            maxFeePerGas: '20000000000',
            maxPriorityFeePerGas: '1000000000',
            nonce: 10,
            chainId: 1,
          },
        };

        const result = validateNonceRetryOptions(validOptions);
        expect(result.maxRetries).toBe(3);
        expect(typeof result.executeTransaction).toBe('function');
      });

      it('should throw for invalid maxRetries', () => {
        const invalidOptions = {
          maxRetries: 0, // 少なくとも1であるべき
          executeTransaction: vi.fn(),
          txParams: {
            to: '0x742d35Cc6634C0532925a3b8D4C9db7C9C0C7A8A',
            value: '1000000000000000000',
            gasLimit: '21000',
            maxFeePerGas: '20000000000',
            maxPriorityFeePerGas: '1000000000',
            nonce: 10,
            chainId: 1,
          },
        };

        expect(() => validateNonceRetryOptions(invalidOptions)).toThrow();
      });

      it('should throw for invalid executeTransaction', () => {
        const invalidOptions = {
          maxRetries: 3,
          executeTransaction: 'not-a-function',
          txParams: {
            to: '0x742d35Cc6634C0532925a3b8D4C9db7C9C0C7A8A',
            value: '1000000000000000000',
            gasLimit: '21000',
            maxFeePerGas: '20000000000',
            maxPriorityFeePerGas: '1000000000',
            nonce: 10,
            chainId: 1,
          },
        };

        expect(() => validateNonceRetryOptions(invalidOptions)).toThrow();
      });
    });

    describe('validateNonceError comprehensive coverage', () => {
      it('should validate various nonce error patterns', () => {
        const nonceErrors = [
          { message: 'nonce too low' },
          { message: 'NONCE TOO HIGH' },
          { message: 'invalid nonce' },
          { message: 'nonce: expected 42' },
          { message: 'replacement transaction underpriced' },
          { message: 'transaction already known' },
          { details: 'nonce too low in details' },
          { cause: { message: 'nonce too high in cause' } },
        ];

        for (const error of nonceErrors) {
          expect(validateNonceError(error)).toBe(true);
        }
      });

      it('should return false for non-nonce errors', () => {
        const nonNonceErrors = [
          { message: 'insufficient funds' },
          { message: 'gas too low' },
          { message: 'execution reverted' },
          'string error',
          null,
          undefined,
          {},
          { message: null },
          { details: null },
          { cause: null },
        ];

        for (const error of nonNonceErrors) {
          expect(validateNonceError(error)).toBe(false);
        }
      });

      it('should handle malformed error objects gracefully', () => {
        const malformedErrors = [
          { message: 123 },
          { details: true },
          { cause: { message: [] } },
          { message: '', details: '', cause: { message: '' } },
        ];

        for (const error of malformedErrors) {
          expect(() => validateNonceError(error)).not.toThrow();
        }
      });
    });
  });
});

describe('Additional Schema Boundary and Negative Tests', () => {
  describe('TransactionHashSchema', () => {
    it('should accept valid 0x-prefixed 64-hex string', () => {
      const hash = '0x' + 'a'.repeat(64);
      const result = TransactionHashSchema.safeParse(hash);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(hash as any);
      }
    });
    it('should reject missing 0x prefix', () => {
      const hash = 'a'.repeat(64);
      expect(TransactionHashSchema.safeParse(hash).success).toBe(false);
    });
    it('should reject wrong length', () => {
      const hash = '0x' + 'a'.repeat(63);
      expect(TransactionHashSchema.safeParse(hash).success).toBe(false);
    });
    it('should reject invalid hex characters', () => {
      const hash = '0x' + 'g'.repeat(64);
      expect(TransactionHashSchema.safeParse(hash).success).toBe(false);
    });
  });

  describe('RawPrivateKeySchema', () => {
    it('should accept 64-hex without 0x prefix', () => {
      const key = 'f'.repeat(64);
      expect(RawPrivateKeySchema.safeParse(key).success).toBe(true);
    });
    it('should accept with 0x prefix', () => {
      const key = '0x' + 'f'.repeat(64);
      expect(RawPrivateKeySchema.safeParse(key).success).toBe(true);
    });
    it('should reject empty string', () => {
      const key = '';
      const result = RawPrivateKeySchema.safeParse(key);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]!.message).toContain('秘密鍵が空です');
      }
    });
    it('should reject wrong length', () => {
      const key = 'f'.repeat(63);
      expect(RawPrivateKeySchema.safeParse(key).success).toBe(false);
    });
  });

  describe('FilePathSchema', () => {
    it('should accept path ending with .key', () => {
      expect(FilePathSchema.safeParse('secret.key').success).toBe(true);
    });
    it('should reject empty path', () => {
      expect(FilePathSchema.safeParse('').success).toBe(false);
    });
    it('should reject non-.key extension', () => {
      expect(FilePathSchema.safeParse('secret.pem').success).toBe(false);
    });
  });

  describe('PrivateKeyFormatSchema', () => {
    it('should accept valid 0x-prefixed 64-hex key', () => {
      const key = '0x' + '0'.repeat(64);
      expect(PrivateKeyFormatSchema.safeParse(key).success).toBe(true);
    });
    it('should reject missing 0x prefix', () => {
      const key = '0'.repeat(64);
      expect(PrivateKeyFormatSchema.safeParse(key).success).toBe(false);
    });
  });

  describe('RpcUrlSchema', () => {
    it('should accept http URL', () => {
      expect(RpcUrlSchema.safeParse('http://localhost').success).toBe(true);
    });
    it('should accept https URL', () => {
      expect(RpcUrlSchema.safeParse('https://example.com').success).toBe(true);
    });
    it('should reject invalid protocol', () => {
      expect(RpcUrlSchema.safeParse('ftp://example.com').success).toBe(false);
    });
    it('should reject empty string', () => {
      expect(RpcUrlSchema.safeParse('').success).toBe(false);
    });
    it('should reject URL with empty hostname and show correct error message', () => {
      const result = RpcUrlSchema.safeParse('http:///path');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]!.message).toBe('RPC URLのホスト名が無効です');
      }
    });
  });

  describe('ChainIdSchema', () => {
    it('should accept positive integer', () => {
      expect(ChainIdSchema.safeParse(1).success).toBe(true);
    });
    it('should reject zero', () => {
      expect(ChainIdSchema.safeParse(0).success).toBe(false);
    });
    it('should reject negative', () => {
      expect(ChainIdSchema.safeParse(-1).success).toBe(false);
    });
    it('should reject non-integer', () => {
      expect(ChainIdSchema.safeParse(1.5).success).toBe(false);
    });
  });

  describe('NativeCurrencySchema', () => {
    it('should reject empty name', () => {
      const obj = { name: '', symbol: 'ETH', decimals: 18 };
      expect(NativeCurrencySchema.safeParse(obj).success).toBe(false);
    });
    it('should reject empty symbol', () => {
      const obj = { name: 'Ether', symbol: '', decimals: 18 };
      expect(NativeCurrencySchema.safeParse(obj).success).toBe(false);
    });
    it('should reject negative decimals', () => {
      const result = NativeCurrencySchema.safeParse({ name: 'Token', symbol: 'TKN', decimals: -1 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]!.message).toBe('小数点以下桁数は0以上である必要があります');
      }
    });
    it('should reject non-integer decimals', () => {
      const obj = { name: 'Ether', symbol: 'ETH', decimals: 1.5 };
      expect(NativeCurrencySchema.safeParse(obj).success).toBe(false);
    });
  });

  describe('SignedTransactionSchema', () => {
    it('should accept valid signed hex', () => {
      const tx = '0x' + 'a'.repeat(10);
      expect(SignedTransactionSchema.safeParse(tx).success).toBe(true);
    });
    it('should reject empty string', () => {
      expect(SignedTransactionSchema.safeParse('').success).toBe(false);
    });
    it('should reject missing 0x', () => {
      expect(SignedTransactionSchema.safeParse('a'.repeat(10)).success).toBe(false);
    });
    it('should reject hex string with correct prefix but not at start', () => {
      const tx = 'foo0x' + 'a'.repeat(10);
      expect(SignedTransactionSchema.safeParse(tx).success).toBe(false);
    });
    it('should reject hex string with trailing characters', () => {
      const tx = '0x' + 'a'.repeat(10) + 'foo';
      expect(SignedTransactionSchema.safeParse(tx).success).toBe(false);
    });
  });

  describe('ErrorObjectSchema', () => {
    it('should default message to empty string', () => {
      const obj = {};
      const result = ErrorObjectSchema.parse(obj);
      expect(result.message).toBe('');
    });
  });

  describe('ErrorStringSchema', () => {
    it('should accept non-empty string', () => {
      expect(ErrorStringSchema.safeParse('error').success).toBe(true);
    });
    it('should reject empty string', () => {
      expect(ErrorStringSchema.safeParse('').success).toBe(false);
    });
  });
});

// additional coverage for untested schemas
describe('Internal Schema Completeness Tests', () => {
  describe('PackageJsonSchema', () => {
    it('should accept valid version string', () => {
      const pj = { version: '0.0.1' };
      const result = PackageJsonSchema.safeParse(pj);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('0.0.1');
      }
    });
    it('should reject empty version', () => {
      expect(PackageJsonSchema.safeParse({ version: '' }).success).toBe(false);
    });
    it('should allow extra properties', () => {
      const pj = { version: '1.2.3', name: 'app', foo: 'bar' };
      expect(PackageJsonSchema.safeParse(pj).success).toBe(true);
    });
  });

  describe('LoggerSchema', () => {
    it('should accept valid logger object', () => {
      const logger = { info: () => {}, warn: () => {}, error: () => {}, data: () => {} };
      expect(LoggerSchema.safeParse(logger).success).toBe(true);
    });
    it('should reject missing methods', () => {
      // warnとerrorが欠けている
      const logger: any = { info: () => {} };
      expect(LoggerSchema.safeParse(logger).success).toBe(false);
    });
  });

  describe('ExecuteTransactionResultSchema', () => {
    it('should accept valid result with hash only', () => {
      const res = { transactionHash: '0x' + 'a'.repeat(64) };
      expect(ExecuteTransactionResultSchema.safeParse(res).success).toBe(true);
    });
    it('should accept with optional explorerUrl', () => {
      const res = { transactionHash: '0x' + 'b'.repeat(64), explorerUrl: 'https://example.com' };
      expect(ExecuteTransactionResultSchema.safeParse(res).success).toBe(true);
    });
    it('should reject missing transactionHash', () => {
      expect(ExecuteTransactionResultSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('ChainConfigSchema', () => {
    it('should accept valid chain config', () => {
      const cfg = {
        id: 1,
        name: 'TestChain',
        nativeCurrency: { name: 'Coin', symbol: 'C', decimals: 8 },
        rpcUrls: { default: { http: ['https://rpc.test'] } },
      };
      expect(ChainConfigSchema.safeParse(cfg).success).toBe(true);
    });
    it('should reject missing fields', () => {
      const cfg: any = { id: 1, name: '', nativeCurrency: {}, rpcUrls: {} };
      expect(ChainConfigSchema.safeParse(cfg).success).toBe(false);
    });
    it('should reject empty chain name with correct error message', () => {
      const cfg: any = {
        id: 1,
        name: '',
        nativeCurrency: { name: 'Coin', symbol: 'C', decimals: 8 },
        rpcUrls: { default: { http: ['https://rpc.test'] } },
      };
      const result = ChainConfigSchema.safeParse(cfg);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]!.message).toBe('チェーン名が必要です');
      }
    });
  });

  describe('NetworkConfigSchema', () => {
    it('should accept valid network config', () => {
      const net = {
        explorerBaseUrl: 'https://explorer.test',
        name: 'Network',
        chain: {
          id: 2,
          name: 'Chain',
          nativeCurrency: { name: 'Token', symbol: 'T', decimals: 18 },
          rpcUrls: { default: { http: ['https://rpc.chain'] } },
        },
      };
      expect(NetworkConfigSchema.safeParse(net).success).toBe(true);
    });
    it('should reject incomplete config', () => {
      const net: any = { explorerBaseUrl: '', name: 'X', chain: null };
      expect(NetworkConfigSchema.safeParse(net).success).toBe(false);
    });
    it('should reject missing explorerBaseUrl with correct error message', () => {
      const net: any = {
        explorerBaseUrl: '',
        name: 'Net',
        chain: {
          id: 1,
          name: 'Chain',
          nativeCurrency: { name: 'Coin', symbol: 'C', decimals: 8 },
          rpcUrls: { default: { http: ['https://rpc'] } },
        },
      };
      const result = NetworkConfigSchema.safeParse(net);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]!.message).toBe('explorerBaseUrlが必要です');
      }
    });
    it('should reject missing name with correct error message', () => {
      const net: any = {
        explorerBaseUrl: 'https://ex.com',
        name: '',
        chain: {
          id: 1,
          name: 'Chain',
          nativeCurrency: { name: 'Coin', symbol: 'C', decimals: 8 },
          rpcUrls: { default: { http: ['https://rpc'] } },
        },
      };
      const result = NetworkConfigSchema.safeParse(net);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]!.message).toBe('nameが必要です');
      }
    });
  });
});

describe('Additional Negative Tests for Schema', () => {
  describe('ChainIdSchema negative tests', () => {
    it('should reject non-integer chainId', () => {
      const result = ChainIdSchema.safeParse(1.5);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]!.message).toBe('チェーンIDは整数である必要があります');
      }
    });
    it('should reject non-positive chainId', () => {
      const resultZero = ChainIdSchema.safeParse(0);
      expect(resultZero.success).toBe(false);
      if (!resultZero.success) {
        expect(resultZero.error.errors[0]!.message).toBe('チェーンIDは正の整数である必要があります');
      }
      const resultNegative = ChainIdSchema.safeParse(-5);
      expect(resultNegative.success).toBe(false);
      if (!resultNegative.success) {
        expect(resultNegative.error.errors[0]!.message).toBe(
          'チェーンIDは正の整数である必要があります'
        );
      }
    });
  });

  describe('NativeCurrencySchema negative tests', () => {
    it('should reject empty name', () => {
      const result = NativeCurrencySchema.safeParse({ name: '', symbol: 'SYM', decimals: 0 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]!.message).toBe('通貨名が必要です');
      }
    });
    it('should reject empty symbol', () => {
      const result = NativeCurrencySchema.safeParse({ name: 'Token', symbol: '', decimals: 0 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]!.message).toBe('通貨シンボルが必要です');
      }
    });
    it('should reject negative decimals', () => {
      const result = NativeCurrencySchema.safeParse({ name: 'Token', symbol: 'TKN', decimals: -1 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]!.message).toBe('小数点以下桁数は0以上である必要があります');
      }
    });
  });

  describe('CliOptionsSchema refine tests', () => {
    it('should reject broadcast true without rpcUrl', () => {
      expect(() =>
        validateCliOptions({ keyFile: 'key', params: 'p', broadcast: true })
      ).toThrowError(
        '--broadcastオプションを使用する場合は、--rpc-urlオプションでRPCエンドポイントを指定する必要があります。'
      );
    });
    it('should accept broadcast false with rpcUrl provided', () => {
      const result = validateCliOptions({
        keyFile: 'key',
        params: 'p',
        broadcast: false,
        rpcUrl: 'http://example.com',
      });
      expect(result.broadcast).toBe(false);
      expect(result.rpcUrl).toBe('http://example.com');
    });
  });
});

describe('Additional Schema Strict and Negative Tests II', () => {
  const validTxParams = {
    to: '0x' + 'a'.repeat(40),
    value: '1000',
    gasLimit: '21000',
    maxFeePerGas: '100',
    maxPriorityFeePerGas: '10',
    nonce: 1,
    chainId: 1,
  };

  describe('EIP1559TxParamsSchema strict mode', () => {
    it('should reject unknown field', () => {
      const result = EIP1559TxParamsSchema.safeParse({ ...validTxParams, extra: 'x' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]!.message).toBe(
          'EIP-1559トランザクションで許可されていないフィールドが含まれています。'
        );
      }
    });
  });

  describe('ExecuteTransactionResultSchema', () => {
    it('should reject invalid explorerUrl', () => {
      const res = { transactionHash: '0x' + 'a'.repeat(64), explorerUrl: 'invalid-url' };
      const result = ExecuteTransactionResultSchema.safeParse(res);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]!.message).toContain('有効なURL');
      }
    });
  });

  describe('NonceRetryOptionsSchema boundary tests', () => {
    const baseOpts = {
      executeTransaction: vi.fn().mockResolvedValue({ transactionHash: '0x1' }),
      txParams: validTxParams,
    };
    it('should reject maxRetries > 10', () => {
      expect(() => validateNonceRetryOptions({ ...baseOpts, maxRetries: 11 })).toThrowError(
        /maxRetriesは10以下である必要があります/
      );
    });
  });

  describe('TransactionProcessorOptionsSchema negative tests', () => {
    const base = {
      privateKey: '0x' + '1'.repeat(64),
      txParams: validTxParams,
      maxRetries: 3,
    };
    it('should reject empty privateKey', () => {
      expect(() => validateTransactionProcessorOptions({ ...base, privateKey: '' })).toThrow();
    });
  });

  describe('ErrorObjectSchema negative tests', () => {
    it('should reject non-string message', () => {
      const result = ErrorObjectSchema.safeParse({ message: 123 });
      expect(result.success).toBe(false);
    });
  });

  describe('ErrorStringSchema negative tests', () => {
    it('should reject non-string input', () => {
      const result = ErrorStringSchema.safeParse(123);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]!.message).toBe('Expected string, received number');
      }
    });
  });

  describe('LoggerSchema negative tests', () => {
    it('should reject non-function warn', () => {
      const obj: any = { info: () => {}, warn: 'warn', error: () => {} };
      const result = LoggerSchema.safeParse(obj);
      expect(result.success).toBe(false);
    });
  });
});
