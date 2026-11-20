import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    testTimeout: 45_000,
    hookTimeout: 60_000,
    globals: false,
    globalSetup: './tests/globalSetup.ts',
    env: {
      DATABASE_URL: 'file:./test.db',
      APPLE_OAUTH_AUDIENCES: 'services-id'
    },
    include: ['tests/**/*.test.ts']
  }
});
