import { type Options, defineConfig } from 'tsup';

const commonEsbuildOptions: Options['esbuildOptions'] = (options) => {
  options.platform = 'node';
  options.mainFields = ['module', 'main'];
};

// Base configuration for library builds
const baseLibraryConfig = {
  entry: ['src/index.ts'],
  outDir: 'dist',
  splitting: false,
  sourcemap: true,
  minify: false,
  shims: true,
  external: ['commander', 'viem', 'zod'],
  target: 'node18',
  esbuildOptions: commonEsbuildOptions,
};

export const tsupConfig = defineConfig([
  // Library build - CommonJS
  {
    ...baseLibraryConfig,
    format: ['cjs'],
    outExtension: () => ({ js: '.cjs' }),
    clean: true,
    dts: true,
  },
  // Library build - ES Module
  {
    ...baseLibraryConfig,
    format: ['esm'],
    outExtension: () => ({ js: '.mjs' }),
    clean: false,
    dts: false,
  },
  // CLI build
  {
    entry: { cli: 'src/cli/cli.ts' },
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
    target: 'node18',
    esbuildOptions: commonEsbuildOptions,
  },
]);

export default tsupConfig;
