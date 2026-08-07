import { describe, expect, it } from 'vitest';
import { matchesConfiguredStoreProductIdentifier } from './subscriptionProduct.js';

describe('matchesConfiguredStoreProductIdentifier', () => {
  it('accepts the configured identifier and approved Android base plan', () => {
    expect(
      matchesConfiguredStoreProductIdentifier(
        'dispute_basic_monthly',
        'dispute_basic_monthly'
      )
    ).toBe(true);
    expect(
      matchesConfiguredStoreProductIdentifier(
        'dispute_basic_monthly:monthly-plan',
        'dispute_basic_monthly'
      )
    ).toBe(true);
  });

  it('fails closed for blank, unrelated, and unapproved base plans', () => {
    expect(matchesConfiguredStoreProductIdentifier(null, 'dispute_basic_monthly')).toBe(false);
    expect(matchesConfiguredStoreProductIdentifier('', 'dispute_basic_monthly')).toBe(false);
    expect(
      matchesConfiguredStoreProductIdentifier(
        'dispute_basic_monthly:legacy-plan',
        'dispute_basic_monthly'
      )
    ).toBe(false);
    expect(
      matchesConfiguredStoreProductIdentifier(
        'other:monthly-plan',
        'dispute_basic_monthly'
      )
    ).toBe(false);
  });
});
