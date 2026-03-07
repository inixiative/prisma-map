import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/v7/index.ts', 'src/v6/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: true,
  treeshake: true,
  outDir: 'dist',
  platform: 'node',
});
