import { describe, expect, it } from 'vitest';
import {
  calculateBasicPay,
  calculateGrossPay,
  calculateNetPay,
  calculateOvertimePay
} from './payCalculations.js';

describe('pay calculations', () => {
  it('calculates basic and overtime pay', () => {
    expect(calculateBasicPay(8, 25)).toBe(200);
    expect(calculateOvertimePay(2, 37.5)).toBe(75);
  });

  it('rounds pay calculations to 2 decimals', () => {
    expect(calculateBasicPay(1.335, 10)).toBe(13.35);
    expect(calculateOvertimePay(1.5, 33.333)).toBe(50);
  });

  it('rounds midpoint money cases safely', () => {
    expect(calculateBasicPay(1.005, 1)).toBe(1.01);
    expect(calculateBasicPay(10.075, 1)).toBe(10.08);
  });

  it('calculates gross and net pay', () => {
    expect(calculateGrossPay(200, 75, 20, 0, 0)).toBe(295);
    expect(calculateNetPay(295, 15)).toBe(280);
  });

  it('rounds summed pay components safely', () => {
    expect(calculateGrossPay(1.005, 10.075, 0, 0, 0)).toBe(11.08);
    expect(calculateNetPay(10.075, 0)).toBe(10.08);
  });

  it('rejects negative basic pay inputs', () => {
    expect(() => calculateBasicPay(-1, 25)).toThrow('Hours cannot be negative');
    expect(() => calculateBasicPay(8, -25)).toThrow('Hourly rate cannot be negative');
  });

  it('rejects non-finite basic pay inputs', () => {
    expect(() => calculateBasicPay(Number.NaN, 25)).toThrow('Hours must be finite');
    expect(() => calculateBasicPay(8, Number.POSITIVE_INFINITY)).toThrow(
      'Hourly rate must be finite'
    );
  });

  it('rejects negative overtime pay inputs', () => {
    expect(() => calculateOvertimePay(-1, 37.5)).toThrow('Overtime hours cannot be negative');
    expect(() => calculateOvertimePay(2, -37.5)).toThrow('Overtime rate cannot be negative');
  });

  it('rejects non-finite overtime pay inputs', () => {
    expect(() => calculateOvertimePay(Number.NaN, 37.5)).toThrow(
      'Overtime hours must be finite'
    );
    expect(() => calculateOvertimePay(2, Number.POSITIVE_INFINITY)).toThrow(
      'Overtime rate must be finite'
    );
  });

  it('rejects negative gross pay components', () => {
    expect(() => calculateGrossPay(200, 75, -1, 0, 0)).toThrow('Allowances cannot be negative');
    expect(() => calculateGrossPay(200, 75, 20, -1, 0)).toThrow('Rest day pay cannot be negative');
    expect(() => calculateGrossPay(200, 75, 20, 0, -1)).toThrow(
      'Public holiday pay cannot be negative'
    );
  });

  it('rejects non-finite gross pay components', () => {
    expect(() => calculateGrossPay(Number.NaN, 75, 20, 0, 0)).toThrow(
      'Basic pay must be finite'
    );
    expect(() => calculateGrossPay(200, Number.POSITIVE_INFINITY, 20, 0, 0)).toThrow(
      'Overtime pay must be finite'
    );
    expect(() => calculateGrossPay(200, 75, Number.NaN, 0, 0)).toThrow(
      'Allowances must be finite'
    );
    expect(() => calculateGrossPay(200, 75, 20, Number.POSITIVE_INFINITY, 0)).toThrow(
      'Rest day pay must be finite'
    );
    expect(() => calculateGrossPay(200, 75, 20, 0, Number.NaN)).toThrow(
      'Public holiday pay must be finite'
    );
  });

  it('rejects negative net pay inputs', () => {
    expect(() => calculateNetPay(-1, 15)).toThrow('Gross pay cannot be negative');
    expect(() => calculateNetPay(295, -1)).toThrow('Deductions cannot be negative');
  });

  it('rejects non-finite net pay inputs', () => {
    expect(() => calculateNetPay(Number.NaN, 15)).toThrow('Gross pay must be finite');
    expect(() => calculateNetPay(295, Number.POSITIVE_INFINITY)).toThrow(
      'Deductions must be finite'
    );
  });
});
