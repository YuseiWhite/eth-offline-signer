import { defineConfig } from 'vitest/config';

export const vitestConfig = defineConfig({
  test: {
    globals: false,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        global: {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
      },
    },
    testTimeout: 30000,
  },
});

export default vitestConfig;
