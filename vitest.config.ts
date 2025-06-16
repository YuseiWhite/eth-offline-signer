import { defineConfig } from 'vitest/config';

export const vitestConfig = defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
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
