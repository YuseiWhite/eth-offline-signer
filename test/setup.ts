import { beforeAll } from 'vitest';

beforeAll(() => {
  // テスト環境の初期化
  process.env.NODE_ENV = 'test';
  process.env.VITEST = 'true';

  // CLIテストでのCommanderリスナー警告を抑制
  process.setMaxListeners(50);
});
