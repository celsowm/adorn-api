import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/config/index.ts', 'src/decorators/index.ts'],
  format: ['cjs', 'esm'],
  outDir: 'dist',
  clean: true,
  dts: true,
  sourcemap: true,
  target: 'esnext',
});
