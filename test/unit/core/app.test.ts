import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { InvalidInputError } from '../../../src/utils/errors';

const mockLoadPrivateKey = vi.fn();
const mockProcessTransaction = vi.fn();
const mockGetDisplayNetworkInfo = vi.fn();
const mockPrivateKeyToAccount = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock('../../../src/core/keyManager', () => ({
  loadPrivateKey: mockLoadPrivateKey,
}));

vi.mock('../../../src/core/transactionProcessor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/transactionProcessor')>();
  return {
    ...actual,
    processTransaction: mockProcessTransaction,
  };
});

vi.mock('../../../src/core/networkConfig', () => ({
  getDisplayNetworkInfo: mockGetDisplayNetworkInfo,
}));

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: mockPrivateKeyToAccount,
}));

vi.mock('node:fs', () => ({
  readFileSync: mockReadFileSync,
}));

let runCli: typeof import('../../../src/core/app.js').runCli;

describe('app.ts', () => {
  beforeAll(async () => {
    ({ runCli } = await import('../../../src/core/app.js'));
  });
  let mockConsoleError: ReturnType<typeof vi.fn>;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    originalConsoleError = console.error;
    mockConsoleError = vi.fn();
    console.error = mockConsoleError;
    vi.clearAllMocks();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('loadTransactionParams', () => {
    const validOptions = {
      keyFile: 'test.key',
      params: 'test.json',
      broadcast: false,
    };

    it('should load valid transaction params', async () => {
      const validTxParams = {
        to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        value: '1',
        chainId: 1,
        nonce: 0,
        gasLimit: '21000',
        maxFeePerGas: '1',
        maxPriorityFeePerGas: '1',
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(validTxParams));
      const cleanupMock = vi.fn();
      mockLoadPrivateKey.mockResolvedValue({
        privateKey: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        cleanup: cleanupMock,
      });
      mockPrivateKeyToAccount.mockReturnValue({
        address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      });
      mockGetDisplayNetworkInfo.mockReturnValue({
        name: 'Ethereum Mainnet',
        type: 'builtin',
        chainId: 1,
      });
      mockProcessTransaction.mockResolvedValue({
        signedTransaction: '0xsigned',
      });

      await expect(runCli(validOptions)).resolves.not.toThrow();
      expect(cleanupMock).toHaveBeenCalled();
    });

    it('should throw InvalidInputError on ZodError', async () => {
      const invalidTxParams = {
        to: 'invalid',
        value: '1',
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(invalidTxParams));

      await expect(runCli(validOptions)).rejects.toThrow(InvalidInputError);
    });

    it('should throw InvalidInputError on JSON parse error', async () => {
      mockReadFileSync.mockReturnValue('invalid json');

      await expect(runCli(validOptions)).rejects.toThrow(InvalidInputError);
    });

    it('should throw InvalidInputError on file read error', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(runCli(validOptions)).rejects.toThrow(InvalidInputError);
    });
  });

  describe('displayNetworkInfo', () => {
    it('should display mainnet network info', async () => {
      const validOptions = {
        keyFile: 'test.key',
        params: 'test.json',
        broadcast: false,
      };
      const validTxParams = {
        to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        value: '1',
        chainId: 1,
        nonce: 0,
        gasLimit: '21000',
        maxFeePerGas: '1',
        maxPriorityFeePerGas: '1',
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(validTxParams));
      mockLoadPrivateKey.mockResolvedValue({
        privateKey: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        cleanup: vi.fn(),
      });
      mockPrivateKeyToAccount.mockReturnValue({
        address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      });
      mockGetDisplayNetworkInfo.mockReturnValue({
        name: 'Ethereum Mainnet',
        type: 'builtin',
        chainId: 1,
      });
      mockProcessTransaction.mockResolvedValue({
        signedTransaction: '0xsigned',
      });

      await runCli(validOptions);

      expect(mockGetDisplayNetworkInfo).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('検出されたネットワーク: Ethereum Mainnet')
      );
    });

    it('should display custom network warning', async () => {
      const validOptions = {
        keyFile: 'test.key',
        params: 'test.json',
        broadcast: false,
      };
      const validTxParams = {
        to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        value: '1',
        chainId: 999,
        nonce: 0,
        gasLimit: '21000',
        maxFeePerGas: '1',
        maxPriorityFeePerGas: '1',
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(validTxParams));
      mockLoadPrivateKey.mockResolvedValue({
        privateKey: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        cleanup: vi.fn(),
      });
      mockPrivateKeyToAccount.mockReturnValue({
        address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      });
      mockGetDisplayNetworkInfo.mockReturnValue({
        name: 'Custom Network',
        type: 'custom',
        chainId: 999,
      });
      mockProcessTransaction.mockResolvedValue({
        signedTransaction: '0xsigned',
      });

      await runCli(validOptions);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining(
          'カスタムネットワークです。ブロードキャスト先が正しいことを確認してください。'
        )
      );
    });
  });

  describe('runCli full flow', () => {
    const mockCleanup = vi.fn();

    beforeEach(() => {
      mockCleanup.mockClear();
    });

    it('should execute full flow with minimal options', async () => {
      const options = {
        keyFile: 'test.key',
        params: 'test.json',
        broadcast: false,
      };
      const validTxParams = {
        to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        value: '1',
        chainId: 1,
        nonce: 0,
        gasLimit: '21000',
        maxFeePerGas: '1',
        maxPriorityFeePerGas: '1',
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(validTxParams));
      mockLoadPrivateKey.mockResolvedValue({
        privateKey: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        cleanup: mockCleanup,
      });
      mockPrivateKeyToAccount.mockReturnValue({
        address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      });
      mockGetDisplayNetworkInfo.mockReturnValue({
        name: 'Ethereum Mainnet',
        type: 'builtin',
        chainId: 1,
      });
      mockProcessTransaction.mockResolvedValue({
        signedTransaction: '0xsigned',
      });

      await runCli(options);

      expect(mockLoadPrivateKey).toHaveBeenCalledWith('test.key');
      expect(mockProcessTransaction).toHaveBeenCalled();
      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should call cleanup in finally block on error', async () => {
      const options = {
        keyFile: 'test.key',
        params: 'test.json',
        broadcast: false,
      };

      mockReadFileSync.mockReturnValue('invalid json');
      mockLoadPrivateKey.mockResolvedValue({
        privateKey: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        cleanup: mockCleanup,
      });

      await expect(runCli(options)).rejects.toThrow();
      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should not call cleanup if privateKeyHandle is undefined', async () => {
      const options = {
        keyFile: 'test.key',
        params: 'test.json',
        broadcast: false,
      };

      mockLoadPrivateKey.mockRejectedValue(new Error('Key load failed'));

      await expect(runCli(options)).rejects.toThrow();
      expect(mockCleanup).not.toHaveBeenCalled();
    });

    it('should handle privateKeyHandle without cleanup function', async () => {
      const options = {
        keyFile: 'test.key',
        params: 'test.json',
        broadcast: false,
      };
      const validTxParams = {
        to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        value: '1',
        chainId: 1,
        nonce: 0,
        gasLimit: '21000',
        maxFeePerGas: '1',
        maxPriorityFeePerGas: '1',
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(validTxParams));
      mockLoadPrivateKey.mockResolvedValue({
        privateKey: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      });
      mockPrivateKeyToAccount.mockReturnValue({
        address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      });
      mockGetDisplayNetworkInfo.mockReturnValue({
        name: 'Ethereum Mainnet',
        type: 'builtin',
        chainId: 1,
      });
      mockProcessTransaction.mockResolvedValue({
        signedTransaction: '0xsigned',
      });

      await expect(runCli(options)).resolves.not.toThrow();
    });

    it('should include rpcUrl when broadcast is true', async () => {
      const options = {
        keyFile: 'test.key',
        params: 'test.json',
        broadcast: true,
        rpcUrl: 'http://custom-rpc.local',
      };
      const validTxParams = {
        to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        value: '1',
        chainId: 1,
        nonce: 0,
        gasLimit: '21000',
        maxFeePerGas: '1',
        maxPriorityFeePerGas: '1',
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(validTxParams));
      mockLoadPrivateKey.mockResolvedValue({
        privateKey: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        cleanup: vi.fn(),
      });
      mockPrivateKeyToAccount.mockReturnValue({
        address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      });
      mockGetDisplayNetworkInfo.mockReturnValue({
        name: 'Ethereum Mainnet',
        type: 'builtin',
        chainId: 1,
      });
      mockProcessTransaction.mockResolvedValue({
        signedTransaction: '0xsigned',
      });

      await runCli(options);
      // rpcUrlが含まれていることを確認
      expect(mockProcessTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ rpcUrl: 'http://custom-rpc.local' })
      );
    });

    it('should output transaction hash and info on broadcast in non-quiet mode', async () => {
      const options = { keyFile: 'test.key', params: 'test.json', broadcast: true, rpcUrl: 'http://custom-rpc.local' };
      const validTxParams = { to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', value: '1', chainId: 1, nonce: 0, gasLimit: '21000', maxFeePerGas: '1', maxPriorityFeePerGas: '1' };
      mockReadFileSync.mockReturnValue(JSON.stringify(validTxParams));
      mockLoadPrivateKey.mockResolvedValue({ privateKey: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', cleanup: vi.fn() });
      mockPrivateKeyToAccount.mockReturnValue({ address: '0xaddr' });
      mockGetDisplayNetworkInfo.mockReturnValue({ name: 'Net', type: 'builtin', chainId: 1 });
      mockProcessTransaction.mockResolvedValue({
        signedTransaction: '0xsigned',
        broadcast: { broadcastCompleted: true, status: 'SUCCESS', transactionHash: '0xhash', blockNumber: 1n, gasUsed: 21000n, finalNonce: 0, retryCount: 0 }
      });
      const originalLog = console.log;
      const originalError = console.error;
      const mockLog = vi.fn();
      const mockError = vi.fn();
      console.log = mockLog;
      console.error = mockError;

      await runCli(options);

      expect(mockLog).toHaveBeenCalledWith('0xhash');
      expect(mockError).toHaveBeenCalledWith(expect.stringContaining('トランザクションは成功しました'));

      console.log = originalLog;
      console.error = originalError;
    });

    it('should output only transaction hash on broadcast in quiet mode', async () => {
      const options = { keyFile: 'test.key', params: 'test.json', broadcast: true, rpcUrl: 'http://custom-rpc.local', quiet: true };
      const validTxParams = { to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', value: '1', chainId: 1, nonce: 0, gasLimit: '21000', maxFeePerGas: '1', maxPriorityFeePerGas: '1' };
      mockReadFileSync.mockReturnValue(JSON.stringify(validTxParams));
      mockLoadPrivateKey.mockResolvedValue({ privateKey: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', cleanup: vi.fn() });
      mockPrivateKeyToAccount.mockReturnValue({ address: '0xaddr' });
      mockGetDisplayNetworkInfo.mockReturnValue({ name: 'Net', type: 'builtin', chainId: 1 });
      mockProcessTransaction.mockResolvedValue({
        signedTransaction: '0xsigned',
        broadcast: { broadcastCompleted: true, status: 'SUCCESS', transactionHash: '0xhash', blockNumber: 1n, gasUsed: 21000n, finalNonce: 0, retryCount: 0 }
      });
      const originalLog = console.log;
      const originalError = console.error;
      const mockLog = vi.fn();
      const mockError = vi.fn();
      console.log = mockLog;
      console.error = mockError;

      await runCli(options);

      expect(mockLog).toHaveBeenCalledWith('0xhash');
      expect(mockError).not.toHaveBeenCalled();

      console.log = originalLog;
      console.error = originalError;
    });

    it('should output transaction hash and warning on BROADCASTED_BUT_UNCONFIRMED status', async () => {
      const options = { keyFile: 'test.key', params: 'test.json', broadcast: true, rpcUrl: 'http://custom-rpc.local' };
      const validTxParams = { to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', value: '1', chainId: 1, nonce: 0, gasLimit: '21000', maxFeePerGas: '1', maxPriorityFeePerGas: '1' };
      mockReadFileSync.mockReturnValue(JSON.stringify(validTxParams));
      mockLoadPrivateKey.mockResolvedValue({ privateKey: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', cleanup: vi.fn() });
      mockPrivateKeyToAccount.mockReturnValue({ address: '0xaddr' });
      mockGetDisplayNetworkInfo.mockReturnValue({ name: 'Net', type: 'builtin', chainId: 1 });
      mockProcessTransaction.mockResolvedValue({
        signedTransaction: '0xsigned',
        broadcast: { broadcastCompleted: true, status: 'BROADCASTED_BUT_UNCONFIRMED', transactionHash: '0xhash', blockNumber: 1n, gasUsed: 21000n, finalNonce: 0, retryCount: 0 }
      });
      const originalLog = console.log;
      const originalWarn = console.warn;
      console.log = vi.fn();
      console.warn = vi.fn();

      await runCli(options);

      expect(console.log).toHaveBeenCalledWith('0xhash');
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('トランザクションはブロードキャストされましたが確認できませんでした'));

      console.log = originalLog;
      console.warn = originalWarn;
    });

    it('should output signed transaction and info on offline signature in non-quiet mode', async () => {
      const options = { keyFile: 'test.key', params: 'test.json', broadcast: false };
      const validTxParams = { to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', value: '1', chainId: 1, nonce: 0, gasLimit: '21000', maxFeePerGas: '1', maxPriorityFeePerGas: '1' };
      mockReadFileSync.mockReturnValue(JSON.stringify(validTxParams));
      mockLoadPrivateKey.mockResolvedValue({ privateKey: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', cleanup: vi.fn() });
      mockPrivateKeyToAccount.mockReturnValue({ address: '0xaddr' });
      mockGetDisplayNetworkInfo.mockReturnValue({ name: 'Net', type: 'builtin', chainId: 1 });
      mockProcessTransaction.mockResolvedValue({ signedTransaction: '0xsigned' });
      const originalLog = console.log;
      const originalError = console.error;
      const mockLog = vi.fn();
      const mockError = vi.fn();
      console.log = mockLog;
      console.error = mockError;

      await runCli(options);

      expect(mockLog).toHaveBeenCalledWith('0xsigned');
      expect(mockError).toHaveBeenCalledWith(expect.stringContaining('署名済みトランザクションを標準出力しました。'));

      console.log = originalLog;
      console.error = originalError;
    });

    it('should output only signed transaction on offline signature in quiet mode', async () => {
      const options = { keyFile: 'test.key', params: 'test.json', broadcast: false, quiet: true };
      const validTxParams = { to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', value: '1', chainId: 1, nonce: 0, gasLimit: '21000', maxFeePerGas: '1', maxPriorityFeePerGas: '1' };
      mockReadFileSync.mockReturnValue(JSON.stringify(validTxParams));
      mockLoadPrivateKey.mockResolvedValue({ privateKey: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', cleanup: vi.fn() });
      mockPrivateKeyToAccount.mockReturnValue({ address: '0xaddr' });
      mockGetDisplayNetworkInfo.mockReturnValue({ name: 'Net', type: 'builtin', chainId: 1 });
      mockProcessTransaction.mockResolvedValue({ signedTransaction: '0xsigned' });
      const originalLog = console.log;
      const originalError = console.error;
      const mockLog = vi.fn();
      const mockError = vi.fn();
      console.log = mockLog;
      console.error = mockError;

      await runCli(options);

      expect(mockLog).toHaveBeenCalledWith('0xsigned');
      expect(mockError).not.toHaveBeenCalled();

      console.log = originalLog;
      console.error = originalError;
    });
  });
});
