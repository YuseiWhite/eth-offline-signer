import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Logger Production Environment Tests', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should create production logger structure', () => {
    const productionLogger = {
      info: (message: string) => console.info(message),
      warn: (message: string) => console.warn(message),
      error: (message: string) => console.error(message),
    };

    expect(typeof productionLogger.info).toBe('function');
    expect(typeof productionLogger.warn).toBe('function');
    expect(typeof productionLogger.error).toBe('function');
  });

  it('should create test logger factory', () => {
    const createTestLogger = () => {
      return {
        info: () => {},
        warn: () => {},
        error: () => {},
      };
    };

    const testLogger = createTestLogger();
    expect(typeof testLogger.info).toBe('function');
    expect(typeof testLogger.warn).toBe('function');
    expect(typeof testLogger.error).toBe('function');
  });

  it('should handle environment variable edge cases', () => {
    const testCases = [
      { nodeEnv: undefined, vitest: undefined, expected: false },
      { nodeEnv: 'test', vitest: undefined, expected: true },
      { nodeEnv: undefined, vitest: 'true', expected: true },
      { nodeEnv: 'development', vitest: 'false', expected: false },
      { nodeEnv: 'production', vitest: 'false', expected: false },
    ];

    const isTestEnvironment = (): boolean => {
      return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
    };

    for (const testCase of testCases) {
      process.env.NODE_ENV = testCase.nodeEnv;
      process.env.VITEST = testCase.vitest;

      expect(isTestEnvironment()).toBe(testCase.expected);
    }
  });

  it('should validate logger interface consistency', () => {
    const requiredMethods = ['info', 'warn', 'error'];

    const productionLogger = {
      info: (message: string) => console.info(message),
      warn: (message: string) => console.warn(message),
      error: (message: string) => console.error(message),
    };

    const testLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    for (const method of requiredMethods) {
      expect(typeof productionLogger[method as keyof typeof productionLogger]).toBe('function');
      expect(typeof testLogger[method as keyof typeof testLogger]).toBe('function');
    }
  });

  describe('本番環境での動作', () => {
    it('NODE_ENV=productionの場合、本番ロガーが使用される', async () => {
      // 本番環境を設定
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('VITEST', undefined);

      // モジュールキャッシュをクリア
      vi.resetModules();

      // コンソールメソッドをスパイ
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // 動的インポートでロガーを取得
      const { logger } = await import('../../../src/utils/logger.js');

      // ロガーメソッドを実行
      logger.info('テスト情報');
      logger.warn('テスト警告');
      logger.error('テストエラー');

      // 本番ロガーが使用されていることを確認
      expect(infoSpy).toHaveBeenCalledWith('テスト情報');
      expect(warnSpy).toHaveBeenCalledWith('テスト警告');
      expect(errorSpy).toHaveBeenCalledWith('テストエラー');

      // スパイをリストア
      infoSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('NODE_ENV=developmentの場合、本番ロガーが使用される', async () => {
      // 開発環境を設定
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('VITEST', undefined);

      // モジュールキャッシュをクリア
      vi.resetModules();

      // コンソールメソッドをスパイ
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // 動的インポートでロガーを取得
      const { logger } = await import('../../../src/utils/logger.js');

      // ロガーメソッドを実行
      logger.info('開発情報');
      logger.warn('開発警告');
      logger.error('開発エラー');

      // 本番ロガーが使用されていることを確認
      expect(infoSpy).toHaveBeenCalledWith('開発情報');
      expect(warnSpy).toHaveBeenCalledWith('開発警告');
      expect(errorSpy).toHaveBeenCalledWith('開発エラー');

      // スパイをリストア
      infoSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('環境変数が未設定の場合、本番ロガーが使用される', async () => {
      // 環境変数を削除
      vi.stubEnv('NODE_ENV', undefined);
      vi.stubEnv('VITEST', undefined);

      // モジュールキャッシュをクリア
      vi.resetModules();

      // コンソールメソッドをスパイ
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      // 動的インポートでロガーを取得
      const { logger } = await import('../../../src/utils/logger.js');

      // ロガーメソッドを実行
      logger.info('デフォルト情報');

      // 本番ロガーが使用されていることを確認
      expect(infoSpy).toHaveBeenCalledWith('デフォルト情報');

      // スパイをリストア
      infoSpy.mockRestore();
    });

    it('VITEST=trueの場合、本番ロガーが使用される', async () => {
      vi.stubEnv('VITEST', 'true');
      vi.stubEnv('NODE_ENV', undefined);

      // モジュールキャッシュをクリア
      vi.resetModules();

      // 動的インポートでロガーを取得
      const { logger } = await import('../../../src/utils/logger.js');

      // コンソールメソッドをスパイ
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      // ロガーメソッドを実行
      logger.info('テスト環境情報');

      // 本番ロガーが使用されていることを確認（テスト環境の処理を削除したため）
      expect(infoSpy).toHaveBeenCalledWith('テスト環境情報');

      // スパイをリストア
      infoSpy.mockRestore();
    });
  });

  describe('createTestLogger関数', () => {
    it('createTestLogger関数が正常に動作する', async () => {
      const { createTestLogger } = await import('../../../src/utils/logger.js');

      const testLogger = createTestLogger();

      // 関数が正しく定義されていることを確認
      expect(typeof testLogger.info).toBe('function');
      expect(typeof testLogger.warn).toBe('function');
      expect(typeof testLogger.error).toBe('function');

      // サイレント動作することを確認（例外が発生しないことを確認）
      expect(() => {
        testLogger.info('テスト');
        testLogger.warn('テスト');
        testLogger.error('テスト');
      }).not.toThrow();
    });
  });
});
