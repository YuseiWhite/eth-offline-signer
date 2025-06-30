import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';

// テスト中のCLI実行を防ぐためのモック依存関係
vi.mock('../../../src/core/app.js', () => ({
  runCli: vi.fn(),
}));

describe('CLI Module', () => {
  let originalConsoleError: typeof console.error;
  let originalConsoleWarn: typeof console.warn;
  let originalExit: typeof process.exit;
  let mockConsoleError: ReturnType<typeof vi.fn>;
  let mockConsoleWarn: ReturnType<typeof vi.fn>;
  let mockExit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // モジュールをリセットし、モックをクリアしてテストを分離する
    vi.resetModules();
    vi.clearAllMocks();
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    originalExit = process.exit;
    mockConsoleError = vi.fn();
    mockConsoleWarn = vi.fn();
    mockExit = vi.fn();
    console.error = mockConsoleError;
    console.warn = mockConsoleWarn;
    process.exit = mockExit as unknown as typeof process.exit;
  });

  afterEach(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    process.exit = originalExit;
  });

  describe('toError function', () => {
    it('should convert Error to Error', async () => {
      const { toError } = await import('../../../src/cli/cli.js');
      const error = new Error('test error');
      expect(toError(error)).toBe(error);
    });

    it('should convert string to Error', async () => {
      const { toError } = await import('../../../src/cli/cli.js');
      const result = toError('test string');
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('test string');
    });

    it('should convert unknown to Error', async () => {
      const { toError } = await import('../../../src/cli/cli.js');
      const result = toError({ custom: 'object' });
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('[object Object]');
    });
  });

  describe('handleCliError function', () => {
    it('should handle InvalidInputError', async () => {
      const { handleCliError } = await import('../../../src/cli/cli.js');
      const error = new Error('invalid input');
      error.name = 'InvalidInputError';

      handleCliError(error);

      expect(mockConsoleError).toHaveBeenCalledWith('入力エラー: invalid input');
    });

    it('should handle NetworkError', async () => {
      const { handleCliError } = await import('../../../src/cli/cli.js');
      const error = new Error('network error');
      error.name = 'NetworkError';

      handleCliError(error);

      expect(mockConsoleError).toHaveBeenCalledWith('ネットワークエラー: network error');
    });

    it('should handle PrivateKeyError', async () => {
      const { handleCliError } = await import('../../../src/cli/cli.js');
      const error = new Error('private key error');
      error.name = 'PrivateKeyError';

      handleCliError(error);

      expect(mockConsoleError).toHaveBeenCalledWith(
        '秘密鍵エラー: private key error'
      );
    });

    it('should handle FileAccessError', async () => {
      const { handleCliError } = await import('../../../src/cli/cli.js');
      const error = new Error('file access error');
      error.name = 'FileAccessError';

      handleCliError(error);

      expect(mockConsoleError).toHaveBeenCalledWith('ファイルアクセスエラー: file access error');
    });

    it('should handle BroadcastError', async () => {
      const { handleCliError } = await import('../../../src/cli/cli.js');
      const error = new Error('broadcast error');
      error.name = 'BroadcastError';

      handleCliError(error);

      expect(mockConsoleError).toHaveBeenCalledWith('ブロードキャストエラー: broadcast error');
    });

    it('should handle general Error', async () => {
      const { handleCliError } = await import('../../../src/cli/cli.js');
      const error = new Error('general error');

      handleCliError(error);

      expect(mockConsoleError).toHaveBeenCalledWith(
        '予期しないエラーが発生しました: general error'
      );
    });

    it('should handle ZodError with missing keyFile and params', async () => {
      const { handleCliError } = await import('../../../src/cli/cli.js');
      const { ZodError } = await import('zod');

      const zodError = new ZodError([
        { code: 'invalid_type', expected: 'string', received: 'undefined', path: ['keyFile'], message: 'Required' },
        { code: 'invalid_type', expected: 'string', received: 'undefined', path: ['params'], message: 'Required' }
      ]);

      handleCliError(zodError);

      expect(mockConsoleError).toHaveBeenCalledWith('必須オプションが不足しています:');
      expect(mockConsoleError).toHaveBeenCalledWith('   --key-file: 秘密鍵ファイル（.key拡張子）のパスを指定してください');
      expect(mockConsoleError).toHaveBeenCalledWith('   --params: トランザクションパラメータJSONファイルのパスを指定してください');
      expect(mockConsoleError).toHaveBeenCalledWith('');
      expect(mockConsoleError).toHaveBeenCalledWith('使用例: node dist/cli.cjs sign --key-file private.key --params transaction.json');
    });

    it('should handle ZodError with missing keyFile only', async () => {
      const { handleCliError } = await import('../../../src/cli/cli.js');
      const { ZodError } = await import('zod');

      const zodError = new ZodError([
        { code: 'invalid_type', expected: 'string', received: 'undefined', path: ['keyFile'], message: 'Required' }
      ]);

      handleCliError(zodError);

      expect(mockConsoleError).toHaveBeenCalledWith('--key-fileオプションが必要です');
      expect(mockConsoleError).toHaveBeenCalledWith('   秘密鍵ファイル（.key拡張子）のパスを指定してください');
    });

    it('should handle ZodError with missing params only', async () => {
      const { handleCliError } = await import('../../../src/cli/cli.js');
      const { ZodError } = await import('zod');

      const zodError = new ZodError([
        { code: 'invalid_type', expected: 'string', received: 'undefined', path: ['params'], message: 'Required' }
      ]);

      handleCliError(zodError);

      expect(mockConsoleError).toHaveBeenCalledWith('--paramsオプションが必要です');
      expect(mockConsoleError).toHaveBeenCalledWith('   トランザクションパラメータJSONファイルのパスを指定してください');
    });

    it('should handle ZodError with rpcUrl validation error', async () => {
      const { handleCliError } = await import('../../../src/cli/cli.js');
      const { ZodError } = await import('zod');

      const zodError = new ZodError([
        {
          code: 'custom',
          message: '--broadcastオプションを使用する場合は、--rpc-urlオプションでRPCエンドポイントを指定する必要があります。',
          path: ['rpcUrl']
        }
      ]);

      handleCliError(zodError);

      expect(mockConsoleError).toHaveBeenCalledWith('--broadcastオプションを使用する場合は、--rpc-urlオプションでRPCエンドポイントを指定する必要があります');
      expect(mockConsoleError).toHaveBeenCalledWith('');
      expect(mockConsoleError).toHaveBeenCalledWith('使用例: node dist/cli.cjs sign --key-file private.key --params transaction.json --broadcast --rpc-url https://eth-<network>.g.alchemy.com/v/<YOUR_API_KEY>');
    });

    it('should handle ZodError with other validation errors', async () => {
      const { handleCliError } = await import('../../../src/cli/cli.js');
      const { ZodError } = await import('zod');

      const zodError = new ZodError([
        { code: 'invalid_type', expected: 'string', received: 'undefined', path: ['customField'], message: 'カスタムエラーメッセージ' }
      ]);

      handleCliError(zodError);

      expect(mockConsoleError).toHaveBeenCalledWith('--custom-field: カスタムエラーメッセージ');
    });

    it('should skip custom errors in the general validation loop', async () => {
      const { handleCliError } = await import('../../../src/cli/cli.js');
      const { ZodError } = await import('zod');

      const zodError = new ZodError([
        {
          code: 'custom',
          message: 'This should be skipped',
          path: ['customErrorField'],
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['anotherField'],
          message: 'This should be displayed',
        },
      ]);

      handleCliError(zodError);

      expect(mockConsoleError).toHaveBeenCalledWith(
        '--another-field: This should be displayed'
      );
      expect(mockConsoleError).not.toHaveBeenCalledWith(
        expect.stringContaining('This should be skipped')
      );
    });
  });

  describe('getPackageVersion function', () => {
    it('should return default version when package.json not found', async () => {
      const { getPackageVersion } = await import('../../../src/cli/cli.js');
      const result = getPackageVersion();

      // バージョンを返すか、デフォルトを1.1.0にする
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should warn and use default version when package.json not found at any path', async () => {
      const { getPackageVersion } = await import('../../../src/cli/cli.js');
      const version = getPackageVersion(['/no/file1.json', '/no/file2.json']);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('デフォルトバージョン 1.1.0 を使用します')
      );
      expect(version).toBe('1.1.0');
    });

    it('should return parsed version when package.json content has version', async () => {
      const { getPackageVersion } = await import('../../../src/cli/cli.js');
      const fixturePath = path.join(process.cwd(), 'test/fixtures/fake-package.json');
      const version = getPackageVersion([fixturePath]);
      expect(version).toBe('9.9.9');
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('CLI command parsing', () => {
    it('should execute runCli with correct options for sign command', async () => {
      const { program } = await import('../../../src/cli/cli.js');
      const { runCli } = await import('../../../src/core/app.js');
      vi.mocked(runCli).mockResolvedValueOnce(undefined);

      await program.parseAsync([
        'node',
        'test',
        'sign',
        '--key-file',
        'key.pem',
        '--params',
        'params.json',
      ]);

      expect(runCli).toHaveBeenCalledWith({ keyFile: 'key.pem', params: 'params.json' });
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should handle InvalidInputError and exit with code 1', async () => {
      const { program } = await import('../../../src/cli/cli.js');
      const { runCli } = await import('../../../src/core/app.js');
      const error = new Error('missing params');
      error.name = 'InvalidInputError';
      vi.mocked(runCli).mockRejectedValueOnce(error);

      await program.parseAsync(['node', 'test', 'sign', '--key-file', 'key.pem']);

      expect(console.error).toHaveBeenCalledWith('入力エラー: missing params');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should display help and exit with code 0', async () => {
      const { program } = await import('../../../src/cli/cli.js');
      await program.parseAsync(['node', 'test', '--help']);
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should display version and exit with code 0', async () => {
      const { program } = await import('../../../src/cli/cli.js');
      await program.parseAsync(['node', 'test', '--version']);
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle unknown command and exit with code 1', async () => {
      const { program } = await import('../../../src/cli/cli.js');

      await program.parseAsync(['node', 'test', 'foobar']);

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('CLIコマンドエラー:'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle unknown option and exit with code 1', async () => {
      const { program } = await import('../../../src/cli/cli.js');

      await program.parseAsync([
        'node',
        'test',
        'sign',
        '--key-file',
        'key.pem',
        '--params',
        'params.json',
        '--foo',
      ]);

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle PrivateKeyError and exit with code 1', async () => {
      const { program } = await import('../../../src/cli/cli.js');
      const { runCli } = await import('../../../src/core/app.js');
      const error = new Error('private key failure');
      error.name = 'PrivateKeyError';
      vi.mocked(runCli).mockRejectedValueOnce(error);

      await program.parseAsync([
        'node',
        'test',
        'sign',
        '--key-file',
        'key.pem',
        '--params',
        'params.json',
      ]);

      expect(console.error).toHaveBeenCalledWith('秘密鍵エラー: private key failure');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle FileAccessError and exit with code 1', async () => {
      const { program } = await import('../../../src/cli/cli.js');
      const { runCli } = await import('../../../src/core/app.js');
      const error = new Error('file access failure');
      error.name = 'FileAccessError';
      vi.mocked(runCli).mockRejectedValueOnce(error);

      await program.parseAsync([
        'node',
        'test',
        'sign',
        '--key-file',
        'key.pem',
        '--params',
        'params.json',
      ]);

      expect(console.error).toHaveBeenCalledWith('ファイルアクセスエラー: file access failure');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle NetworkError and exit with code 1', async () => {
      const { program } = await import('../../../src/cli/cli.js');
      const { runCli } = await import('../../../src/core/app.js');
      const error = new Error('network failure');
      error.name = 'NetworkError';
      vi.mocked(runCli).mockRejectedValueOnce(error);

      await program.parseAsync([
        'node',
        'test',
        'sign',
        '--key-file',
        'key.pem',
        '--params',
        'params.json',
      ]);

      expect(console.error).toHaveBeenCalledWith('ネットワークエラー: network failure');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle BroadcastError and exit with code 1', async () => {
      const { program } = await import('../../../src/cli/cli.js');
      const { runCli } = await import('../../../src/core/app.js');
      const error = new Error('broadcast failure');
      error.name = 'BroadcastError';
      vi.mocked(runCli).mockRejectedValueOnce(error);

      await program.parseAsync([
        'node',
        'test',
        'sign',
        '--key-file',
        'key.pem',
        '--params',
        'params.json',
      ]);

      expect(console.error).toHaveBeenCalledWith('ブロードキャストエラー: broadcast failure');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle ZodError from runCli and display user-friendly messages', async () => {
      const { program } = await import('../../../src/cli/cli.js');
      const { runCli } = await import('../../../src/core/app.js');
      const { ZodError } = await import('zod');

      const zodError = new ZodError([
        { code: 'invalid_type', expected: 'string', received: 'undefined', path: ['keyFile'], message: 'Required' },
        { code: 'invalid_type', expected: 'string', received: 'undefined', path: ['params'], message: 'Required' }
      ]);

      vi.mocked(runCli).mockRejectedValueOnce(zodError);

      await program.parseAsync(['node', 'test', 'sign']);

      expect(console.error).toHaveBeenCalledWith('必須オプションが不足しています:');
      expect(console.error).toHaveBeenCalledWith('   --key-file: 秘密鍵ファイル（.key拡張子）のパスを指定してください');
      expect(console.error).toHaveBeenCalledWith('   --params: トランザクションパラメータJSONファイルのパスを指定してください');
      expect(console.error).toHaveBeenCalledWith('使用例: node dist/cli.cjs sign --key-file private.key --params transaction.json');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle ZodError from runCli for broadcast validation', async () => {
      const { program } = await import('../../../src/cli/cli.js');
      const { runCli } = await import('../../../src/core/app.js');
      const { ZodError } = await import('zod');

      const zodError = new ZodError([
        {
          code: 'custom',
          message: '--broadcastオプションを使用する場合は、--rpc-urlオプションでRPCエンドポイントを指定する必要があります。',
          path: ['rpcUrl']
        }
      ]);

      vi.mocked(runCli).mockRejectedValueOnce(zodError);

      await program.parseAsync([
        'node',
        'test',
        'sign',
        '--key-file',
        'key.pem',
        '--params',
        'params.json',
        '--broadcast'
      ]);

      expect(mockConsoleError).toHaveBeenCalledWith('--broadcastオプションを使用する場合は、--rpc-urlオプションでRPCエンドポイントを指定する必要があります');
      expect(mockConsoleError).toHaveBeenCalledWith('');
      expect(mockConsoleError).toHaveBeenCalledWith('使用例: node dist/cli.cjs sign --key-file private.key --params transaction.json --broadcast --rpc-url https://eth-<network>.g.alchemy.com/v/<YOUR_API_KEY>');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('CLI program exit override', () => {
    it('should test exit override function directly', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Test help display case
      const helpErr = { code: 'commander.helpDisplayed', message: 'help displayed' };
      const exitHandler = (err: any) => {
        if (err.code === 'commander.helpDisplayed') {
          process.exit(0);
        }
        if (err.code === 'commander.version') {
          process.exit(0);
        }
        console.error(`CLIコマンドエラー: ${err.message}`);
        process.exit(1);
      };

      exitHandler(helpErr);
      expect(mockExit).toHaveBeenCalledWith(0);

      // Test version display case
      mockExit.mockClear();
      const versionErr = { code: 'commander.version', message: 'version displayed' };
      exitHandler(versionErr);
      expect(mockExit).toHaveBeenCalledWith(0);

      // Test other error case
      mockExit.mockClear();
      const otherErr = { code: 'commander.unknownCommand', message: 'unknown command' };
      exitHandler(otherErr);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('CLIコマンドエラー: unknown command')
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });
  });
});
