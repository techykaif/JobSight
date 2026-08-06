import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
