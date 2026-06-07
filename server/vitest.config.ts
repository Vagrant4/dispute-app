import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    globalSetup: './tests/globalSetup.ts',
    env: {
      DATABASE_URL: 'file:./test.db'
    },
    include: ['tests/**/*.test.ts']
  }
});
