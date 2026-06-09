export const EMPLOYMENT_TYPES = ['HOURLY', 'DAILY', 'MONTHLY', 'FREELANCER'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const RATE_TYPES = ['HOURLY', 'DAILY', 'MONTHLY', 'FREELANCER'] as const;
export type RateType = (typeof RATE_TYPES)[number];

export const PROJECT_STATUSES = ['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TIME_ENTRY_STATUSES = ['DRAFT', 'FINALIZED'] as const;
export type TimeEntryStatus = (typeof TIME_ENTRY_STATUSES)[number];

export const EVIDENCE_TYPES = [
  'BEFORE_WORK',
  'DURING_WORK',
  'AFTER_WORK',
  'DEFECT',
  'COMPLETED_WORK',
  'MATERIAL_DELIVERY',
  'VARIATION_WORK',
  'OTHER'
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const GENERATED_DOCUMENT_TYPES = ['progress_claim_pdf', 'progress_claim_csv'] as const;
export type GeneratedDocumentType = (typeof GENERATED_DOCUMENT_TYPES)[number];

export const GENERATED_DOCUMENT_FORMATS = ['pdf', 'csv'] as const;
export type GeneratedDocumentFormat = (typeof GENERATED_DOCUMENT_FORMATS)[number];

export const CLAIMPROOF_DEFAULTS = {
  standardDailyHours: 8,
  standardWeeklyHours: 44,
  overtimeMultiplier: 1.5,
  defaultCurrency: 'SGD'
} as const;
