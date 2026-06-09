import { describe, expect, it } from 'vitest';
import {
  CLAIMPROOF_DEFAULTS,
  EMPLOYMENT_TYPES,
  EVIDENCE_TYPES,
  GENERATED_DOCUMENT_TYPES,
  PROJECT_STATUSES,
  TIME_ENTRY_STATUSES
} from './domain.js';

describe('domain constants', () => {
  it('exports stable ClaimProof domain values', () => {
    expect(EMPLOYMENT_TYPES).toEqual(['HOURLY', 'DAILY', 'MONTHLY', 'FREELANCER']);
    expect(PROJECT_STATUSES).toEqual(['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']);
    expect(TIME_ENTRY_STATUSES).toEqual(['DRAFT', 'FINALIZED']);
    expect(EVIDENCE_TYPES).toContain('COMPLETED_WORK');
    expect(GENERATED_DOCUMENT_TYPES).toEqual(['progress_claim_pdf', 'progress_claim_csv']);
  });

  it('exports Singapore-first app defaults', () => {
    expect(CLAIMPROOF_DEFAULTS).toEqual({
      standardDailyHours: 8,
      standardWeeklyHours: 44,
      overtimeMultiplier: 1.5,
      defaultCurrency: 'SGD'
    });
  });
});
