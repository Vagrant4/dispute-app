import { describe, expect, it } from 'vitest';
import { trialEndForPolicy } from '../src/modules/subscription/subscription.service.js';

const trialDays = 30;
describe('trial policy start', () => {
  it('leaves the existing anchor unchanged when the policy start is unset', () => {
    const verifiedAt = new Date('2026-10-01T00:00:00.000Z');
    expect(trialEndForPolicy(null, verifiedAt, trialDays, null)).toEqual(new Date('2026-10-31T00:00:00.000Z'));
  });

  it('starts an older verified account trial at the policy start', () => {
    const policyStart = new Date('2026-11-01T00:00:00.000Z');
    const verifiedAt = new Date('2026-10-01T00:00:00.000Z');
    expect(trialEndForPolicy(null, verifiedAt, trialDays, policyStart)).toEqual(new Date('2026-12-01T00:00:00.000Z'));
  });

  it('keeps the verified date when it is after the policy start', () => {
    const policyStart = new Date('2026-11-01T00:00:00.000Z');
    const verifiedAt = new Date('2026-11-03T00:00:00.000Z');
    expect(trialEndForPolicy(null, verifiedAt, trialDays, policyStart)).toEqual(new Date('2026-12-03T00:00:00.000Z'));
  });
});
