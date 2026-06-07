import { describe, expect, it } from 'vitest';
import { calculateOvertimeHours, calculateTotalHours } from '../src/utils/timeCalculations.js';

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

  it('returns zero overtime when total hours do not exceed the standard day', () => {
    expect(calculateOvertimeHours(7.75, 8)).toBe(0);
  });

  it('rejects negative total hours', () => {
    expect(() => calculateOvertimeHours(-0.01, 8)).toThrow('Total hours cannot be negative');
  });

  it('rejects non-positive standard daily hours', () => {
    expect(() => calculateOvertimeHours(8, 0)).toThrow('Standard daily hours must be positive');
  });
});
