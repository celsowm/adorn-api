import { defineConfig } from 'vitest/config'
import tsp from 'ts-patch'

tsp.install()

export default defineConfig({
  test: {
    globals: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/transformer-inference.test.ts',
      '**/reflection.test.ts',
    ],
  },
})
