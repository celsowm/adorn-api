import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  outDir: 'dist',
  clean: true,
  dts: true,
  sourcemap: true,
  target: 'es2022',
  esbuildOptions: (options: any) => {
    options.experimentalDecorators = true;
    options.emitDecoratorMetadata = true;
  },
});
