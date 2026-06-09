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

  it('defaults Stripe subscription foundation config to disabled without keys', () => {
    const env = createEnv({ NODE_ENV: 'development' });

    expect(env.stripe.billingMode).toBe('disabled');
    expect(env.stripe.secretKey).toBe('');
    expect(env.stripe.webhookSecret).toBe('');
    expect(env.stripe.priceIds.monthly).toBe('');
    expect(env.stripe.priceIds.yearly).toBe('');
  });

  it('parses Stripe subscription placeholder config when provided', () => {
    const env = createEnv({
      NODE_ENV: 'development',
      STRIPE_BILLING_MODE: 'test',
      STRIPE_SECRET_KEY: 'sk_test_placeholder',
      STRIPE_WEBHOOK_SECRET: 'whsec_placeholder',
      STRIPE_PRICE_ID_MONTHLY: 'price_monthly_placeholder',
      STRIPE_PRICE_ID_YEARLY: 'price_yearly_placeholder'
    });

    expect(env.stripe).toEqual({
      billingMode: 'test',
      secretKey: 'sk_test_placeholder',
      webhookSecret: 'whsec_placeholder',
      priceIds: {
        monthly: 'price_monthly_placeholder',
        yearly: 'price_yearly_placeholder'
      }
    });
  });

  it('rejects unknown Stripe billing modes', () => {
    expect(() =>
      createEnv({
        NODE_ENV: 'development',
        STRIPE_BILLING_MODE: 'sandbox'
      })
    ).toThrow(/STRIPE_BILLING_MODE/);
  });
});
