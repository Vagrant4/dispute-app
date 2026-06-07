import { describe, expect, it } from 'vitest';
import { createEnv } from '../src/config/env.js';

describe('env config', () => {
  it('uses a local JWT secret outside production when JWT_SECRET is missing', () => {
    const env = createEnv({ NODE_ENV: 'development' });

    expect(env.jwtSecret).toBe('claimproof-local-dev-secret');
  });

  it('rejects a missing JWT secret in production', () => {
    expect(() => createEnv({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
  });

  it('rejects a short JWT secret in production', () => {
    expect(() =>
      createEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'too-short'
      })
    ).toThrow(/JWT_SECRET/);
  });
});
