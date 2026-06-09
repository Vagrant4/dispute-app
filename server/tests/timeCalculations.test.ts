import { describe, expect, it } from 'vitest';
import {
  calculateOvertimeHours as sharedCalculateOvertimeHours,
  calculateTotalHours as sharedCalculateTotalHours
} from '@claimproof/shared';
import { calculateOvertimeHours, calculateTotalHours } from '../src/utils/timeCalculations.js';

describe('time calculation compatibility exports', () => {
  it('re-exports shared time calculation utilities', () => {
    expect(calculateTotalHours).toBe(sharedCalculateTotalHours);
    expect(calculateOvertimeHours).toBe(sharedCalculateOvertimeHours);
  });
});
