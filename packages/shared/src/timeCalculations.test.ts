import { describe, expect, it } from 'vitest';
import { calculateOvertimeHours, calculateTotalHours } from './timeCalculations.js';

describe('time calculations', () => {
  it('subtracts inclusive break minutes from clock duration', () => {
    const total = calculateTotalHours(
      new Date('2026-06-07T08:00:00+08:00'),
      new Date('2026-06-07T17:00:00+08:00'),
      60
    );

    expect(total).toBe(8);
  });

  it('rounds claimable hours to 2 decimals', () => {
    const total = calculateTotalHours(
      new Date('2026-06-07T08:00:00+08:00'),
      new Date('2026-06-07T09:20:00+08:00'),
      0
    );

    expect(total).toBe(1.33);
  });

  it('rounds second-level timestamps to 2 decimals safely', () => {
    const total = calculateTotalHours(
      new Date('2026-06-07T08:00:00+08:00'),
      new Date('2026-06-07T17:00:18+08:00'),
      0
    );

    expect(total).toBe(9.01);
  });

  it('rejects invalid clock dates', () => {
    expect(() =>
      calculateTotalHours(
        new Date('invalid'),
        new Date('2026-06-07T17:00:00+08:00'),
        0
      )
    ).toThrow('Clock-in must be a valid date');

    expect(() =>
      calculateTotalHours(
        new Date('2026-06-07T08:00:00+08:00'),
        new Date('invalid'),
        0
      )
    ).toThrow('Clock-out must be a valid date');
  });

  it('rejects clock-out before clock-in', () => {
    expect(() =>
      calculateTotalHours(
        new Date('2026-06-07T17:00:00+08:00'),
        new Date('2026-06-07T08:00:00+08:00'),
        0
      )
    ).toThrow('Clock-out must be after clock-in');
  });

  it('rejects negative break minutes', () => {
    expect(() =>
      calculateTotalHours(
        new Date('2026-06-07T08:00:00+08:00'),
        new Date('2026-06-07T17:00:00+08:00'),
        -1
      )
    ).toThrow('Break minutes cannot be negative');
  });

  it('rejects non-finite break minutes', () => {
    expect(() =>
      calculateTotalHours(
        new Date('2026-06-07T08:00:00+08:00'),
        new Date('2026-06-07T17:00:00+08:00'),
        Number.NaN
      )
    ).toThrow('Break minutes must be finite');

    expect(() =>
      calculateTotalHours(
        new Date('2026-06-07T08:00:00+08:00'),
        new Date('2026-06-07T17:00:00+08:00'),
        Number.POSITIVE_INFINITY
      )
    ).toThrow('Break minutes must be finite');
  });

  it('rejects break minutes that exceed on-site duration', () => {
    expect(() =>
      calculateTotalHours(
        new Date('2026-06-07T08:00:00+08:00'),
        new Date('2026-06-07T09:00:00+08:00'),
        61
      )
    ).toThrow('Break minutes cannot exceed on-site duration');
  });

  it('calculates overtime above standard daily hours', () => {
    expect(calculateOvertimeHours(9.5, 8)).toBe(1.5);
  });

  it('rounds overtime subtraction to 2 decimals safely', () => {
    expect(calculateOvertimeHours(9.005, 8)).toBe(1.01);
  });

  it('returns zero overtime when total hours do not exceed the standard day', () => {
    expect(calculateOvertimeHours(7.75, 8)).toBe(0);
  });

  it('rejects negative total hours', () => {
    expect(() => calculateOvertimeHours(-0.01, 8)).toThrow('Total hours cannot be negative');
  });

  it('rejects non-finite total hours', () => {
    expect(() => calculateOvertimeHours(Number.NaN, 8)).toThrow('Total hours must be finite');
    expect(() => calculateOvertimeHours(Number.POSITIVE_INFINITY, 8)).toThrow(
      'Total hours must be finite'
    );
  });

  it('rejects non-positive standard daily hours', () => {
    expect(() => calculateOvertimeHours(8, 0)).toThrow('Standard daily hours must be positive');
  });

  it('rejects non-finite standard daily hours', () => {
    expect(() => calculateOvertimeHours(8, Number.NaN)).toThrow(
      'Standard daily hours must be finite'
    );
    expect(() => calculateOvertimeHours(8, Number.POSITIVE_INFINITY)).toThrow(
      'Standard daily hours must be finite'
    );
  });
});
