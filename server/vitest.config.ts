import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    env: {
      DATABASE_URL: 'file:./dev.db'
    },
    include: ['tests/**/*.test.ts']
  }
});
