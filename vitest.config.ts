import { defineConfig } from 'vitest/config'
import typescript from '@rollup/plugin-typescript'

export default defineConfig({
  test: {
    globals: true,
  },
  esbuild: false,
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      noEmit: false,
      compilerOptions: {
        sourceMap: true,
      },
    }),
  ],
})
