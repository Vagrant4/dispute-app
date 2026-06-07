import { describe, expect, it } from 'vitest';
import {
  calculateBasicPay,
  calculateGrossPay,
  calculateNetPay,
  calculateOvertimePay
} from '../src/utils/payCalculations.js';

describe('pay calculations', () => {
  it('calculates basic and overtime pay', () => {
    expect(calculateBasicPay(8, 25)).toBe(200);
    expect(calculateOvertimePay(2, 37.5)).toBe(75);
  });

  it('rounds pay calculations to 2 decimals', () => {
    expect(calculateBasicPay(1.335, 10)).toBe(13.35);
    expect(calculateOvertimePay(1.5, 33.333)).toBe(50);
  });

  it('calculates gross and net pay', () => {
    expect(calculateGrossPay(200, 75, 20, 0, 0)).toBe(295);
    expect(calculateNetPay(295, 15)).toBe(280);
  });

  it('rejects negative basic pay inputs', () => {
    expect(() => calculateBasicPay(-1, 25)).toThrow('Hours cannot be negative');
    expect(() => calculateBasicPay(8, -25)).toThrow('Hourly rate cannot be negative');
  });

  it('rejects negative overtime pay inputs', () => {
    expect(() => calculateOvertimePay(-1, 37.5)).toThrow('Overtime hours cannot be negative');
    expect(() => calculateOvertimePay(2, -37.5)).toThrow('Overtime rate cannot be negative');
  });

  it('rejects negative gross pay components', () => {
    expect(() => calculateGrossPay(200, 75, -1, 0, 0)).toThrow('Allowances cannot be negative');
    expect(() => calculateGrossPay(200, 75, 20, -1, 0)).toThrow('Rest day pay cannot be negative');
    expect(() => calculateGrossPay(200, 75, 20, 0, -1)).toThrow('Public holiday pay cannot be negative');
  });

  it('rejects negative net pay inputs', () => {
    expect(() => calculateNetPay(-1, 15)).toThrow('Gross pay cannot be negative');
    expect(() => calculateNetPay(295, -1)).toThrow('Deductions cannot be negative');
  });
});
