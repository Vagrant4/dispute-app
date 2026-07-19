export const PROGRESS_CLAIM_DISCLAIMER =
  "This app helps you record work, time, pay, and evidence for reference. It does not replace legal, accounting, or MOM advice.";

export const LOCAL_REPORT_STORAGE_NOTICE =
  "Generated report files are stored locally on this device and can be shared or exported manually. They are not uploaded or emailed automatically.";

export type WorkerProfileSnapshot = {
  name?: string;
  email?: string;
  phone?: string;
};

export type ClientSnapshot = {
  name?: string;
  contactName?: string | null;
  contactEmail?: string | null;
};

export type ProjectSnapshot = {
  id?: string;
  name?: string;
  description?: string | null;
  hourlyRateCents?: number | null;
  currency?: string;
};

export type TimeEntrySnapshotInput = {
  id: string;
  workDate: string;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes: number;
  activity: string;
  dayType?: "normal" | "off_day" | "holiday" | null;
  locationText?: string | null;
  clockInGpsLatitude?: number | null;
  clockInGpsLongitude?: number | null;
  clockOutGpsLatitude?: number | null;
  clockOutGpsLongitude?: number | null;
};

export type PhotoEvidenceSnapshotInput = {
  id: string;
  timeEntryId?: string | null;
  localUri: string;
  printUri?: string | null;
  caption?: string | null;
  evidenceType?: string | null;
  capturedAt?: string | null;
};

export type PaySnapshotInput = {
  hourlyRateCents?: number | null;
  currency?: string;
  dailyNormalMinutes?: number;
  normalWorkStartTime?: string;
  normalWorkEndTime?: string;
  overtimeMultiplier?: number;
  offDayMultiplier?: number;
  holidayMultiplier?: number;
  allowancesCents?: number;
  deductionsCents?: number;
};

export type ProgressClaimSnapshotInput = {
  generatedAt?: string;
  claimPeriod?: {
    start: string;
    end: string;
  };
  worker?: WorkerProfileSnapshot;
  client?: ClientSnapshot;
  project?: ProjectSnapshot;
  timeEntries?: TimeEntrySnapshotInput[];
  photoEvidence?: PhotoEvidenceSnapshotInput[];
  pay?: PaySnapshotInput;
};

export type DailyWorkLogItem = {
  workDate: string;
  activity: string;
  normalHours: number;
  overtimeHours: number;
  offDayHours: number;
  holidayHours: number;
  dayTypes: string[];
  locations: WorkLocationSnapshot[];
  durationMinutes: number;
  photoEvidenceIds: string[];
};

export type WorkLocationSnapshot = {
  address: string;
  latitude: number | null;
  longitude: number | null;
};

export type ProgressClaimTotals = {
  totalDaysWorked: number;
  totalNormalHours: number;
  totalOvertimeHours: number;
  totalOffDayHours: number;
  totalHolidayHours: number;
  basicPayCents: number;
  overtimePayCents: number;
  offDayPayCents: number;
  holidayPayCents: number;
  allowancesCents: number;
  deductionsCents: number;
  grossPayCents: number;
  netPayCents: number;
  totalClaimAmountCents: number;
};

export type ProgressClaimSnapshot = {
  title: "Progress Claim Report";
  generatedAt: string;
  claimPeriod: {
    start: string;
    end: string;
  };
  worker: WorkerProfileSnapshot;
  client: ClientSnapshot;
  project: Required<Pick<ProjectSnapshot, "currency">> & ProjectSnapshot;
  rateCalculation: {
    currency: string;
    hourlyRateCents: number;
    dailyNormalMinutes: number;
    normalWorkStartTime: string;
    normalWorkEndTime: string;
    overtimeMultiplier: number;
    offDayMultiplier: number;
    holidayMultiplier: number;
  };
  totals: ProgressClaimTotals;
  dailyWorkLog: DailyWorkLogItem[];
  photoEvidence: PhotoEvidenceSnapshotInput[];
  signature: {
    workerSignature: string;
    clientAcknowledgement: string;
    signedAt: string;
  };
  disclaimer: string;
  localStorageNotice: string;
};
