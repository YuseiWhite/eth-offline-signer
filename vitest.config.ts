import { defineConfig } from 'vitest/config';

export const vitestConfig = defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: [
      'test/unit/**/*.test.ts',
      'test/integration/**/*.test.ts',
      'test/property/**/*.test.ts',
    ],
    globalSetup: './test/globalSetup.ts',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      clean: true,
      cleanOnRerun: true,
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'node_modules/**',
        'coverage/**',
        'test/**',
        'dist/**',
        'local/**',
        'docs/**',
      ],
      all: true,
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
