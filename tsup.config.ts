import { defineConfig, type Options } from 'tsup';

const commonEsbuildOptions: Options['esbuildOptions'] = (options) => {
  options.platform = 'node';
  options.mainFields = ['module', 'main'];
};

export default defineConfig([
  // Library build
  {
    entry: ['src/index.ts'],
    outDir: 'dist',
    format: ['cjs'],
    outExtension: () => ({ js: '.cjs' }),
    splitting: false,
    sourcemap: true,
    minify: false,
    clean: true,
    dts: true,
    shims: true,
    external: ['commander', 'viem', 'zod'],
    target: 'node22',
    esbuildOptions: commonEsbuildOptions,
  },
  // CLI build
  {
    entry: { cli: 'src/cli/index.ts' },
    outDir: 'dist',
    format: ['cjs'],
    outExtension: () => ({ js: '.cjs' }),
    splitting: false,
    sourcemap: true,
    minify: true,
    clean: false,
    dts: false,
    shims: true,
    noExternal: ['commander', 'zod', /^viem(\/.*)?$/],
    target: 'node22',
    esbuildOptions: commonEsbuildOptions,
  },
]);
