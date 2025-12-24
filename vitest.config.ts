import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    alias: {
      'adorn-api/config': path.resolve(__dirname, './src/config/index.ts'),
      'adorn-api/decorators': path.resolve(__dirname, './src/decorators/index.ts'),
      'adorn-api/adapters/validation/zod.js': path.resolve(__dirname, './src/adapters/validation/zod.ts'),
      'adorn-api/adapters/errors/defaultMapper.js': path.resolve(__dirname, './src/adapters/errors/defaultMapper.ts'),
      'adorn-api': path.resolve(__dirname, './src/index.ts'),
    },
  },
});
