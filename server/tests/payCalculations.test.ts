import { describe, expect, it } from 'vitest';
import {
  calculateBasicPay as sharedCalculateBasicPay,
  calculateGrossPay as sharedCalculateGrossPay,
  calculateNetPay as sharedCalculateNetPay,
  calculateOvertimePay as sharedCalculateOvertimePay
} from '@claimproof/shared';
import {
  calculateBasicPay,
  calculateGrossPay,
  calculateNetPay,
  calculateOvertimePay
} from '../src/utils/payCalculations.js';

describe('pay calculation compatibility exports', () => {
  it('re-exports shared pay calculation utilities', () => {
    expect(calculateBasicPay).toBe(sharedCalculateBasicPay);
    expect(calculateOvertimePay).toBe(sharedCalculateOvertimePay);
    expect(calculateGrossPay).toBe(sharedCalculateGrossPay);
    expect(calculateNetPay).toBe(sharedCalculateNetPay);
  });
});
