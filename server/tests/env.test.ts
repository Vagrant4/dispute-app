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
    expect(env.revenueCat.webhookSecret).toBe('');
  });

  it('parses RevenueCat webhook secret when provided', () => {
    const env = createEnv({
      NODE_ENV: 'development',
      REVENUECAT_WEBHOOK_SECRET: 'rc_webhook_secret'
    });

    expect(env.revenueCat.webhookSecret).toBe('rc_webhook_secret');
  });

  it('defaults blank Stripe billing mode placeholders to disabled', () => {
    expect(createEnv({ NODE_ENV: 'development', STRIPE_BILLING_MODE: '' }).stripe.billingMode).toBe('disabled');
    expect(createEnv({ NODE_ENV: 'development', STRIPE_BILLING_MODE: '   ' }).stripe.billingMode).toBe('disabled');
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

  it('uses a public server URL for production email links', () => {
    const env = createEnv({
      NODE_ENV: 'production',
      JWT_SECRET: 'a-production-secret-with-more-than-32-characters',
      SERVER_PUBLIC_URL: 'https://dispute-api.example.com/'
    });

    expect(env.serverPublicUrl).toBe('https://dispute-api.example.com');
  });
});
