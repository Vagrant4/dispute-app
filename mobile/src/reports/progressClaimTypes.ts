import type { LocationSource } from "../work/locationEvidence";
import type { BreakInterval, TaskSwitch } from "../work/shiftTimeline";
export const PROGRESS_CLAIM_DISCLAIMER =
  "This app helps you record work, time, pay, and evidence for reference. It does not replace legal, accounting, or MOM advice.";

export const LOCAL_REPORT_STORAGE_NOTICE =
  "Reports are saved on your phone and only leave it when you share them.";

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
  siteAddress?: string | null;
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
  clockOutLocationText?: string | null;
  clockInLocationSource?: LocationSource;
  clockOutLocationSource?: LocationSource;
  clockInGpsAccuracyM?: number | null;
  clockOutGpsAccuracyM?: number | null;
  clockInLocatedAt?: string | null;
  clockOutLocatedAt?: string | null;
  locationNote?: string | null;
  locationHistoryJson?: string | null;
  breakMinutes?: number;
  breakIntervals?: BreakInterval[];
  taskSwitches?: TaskSwitch[];
  taskSegments?: Array<{ taskId: string | null; taskName: string; start: string; end: string; durationMinutes: number }>;

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
  captureSource?: string | null;
  captureTimeSource?: string | null;
  lockHash?: string | null;
  caption?: string | null;
  evidenceType?: string | null;
  capturedAt?: string | null;
};

export type PaySnapshotInput = {
  hourlyRateCents?: number | null;
  rateBasis?: "daily" | "monthly" | "hourly";
  baseRateCents?: number | null;
  currency?: string;
  dailyNormalMinutes?: number;
  normalWorkStartTime?: string;
  normalWorkEndTime?: string;
  overtimeMultiplier?: number;
  offDayMultiplier?: number;
  holidayMultiplier?: number;
  lunchMinutes?: number;
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
  evidenceAudit?: Array<{ message: string; eventAt: string; capturedAt?: string | null }>;
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
  locationEntries?: TimeEntrySnapshotInput[];
  durationMinutes: number;
  photoEvidenceIds: string[];
  basicPayCents: number;
  overtimePayCents: number;
  offDayPayCents: number;
  holidayPayCents: number;
  grossPayCents: number;
  lunchDeductedMinutes: number;
};

export type WorkLocationSnapshot = {
  siteAddress?: string;
  source?: LocationSource;
  accuracy?: number | null;
  locatedAt?: string | null;
  phase?: string;
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
    rateBasis: "daily" | "monthly" | "hourly";
    baseRateCents: number;
    dailyNormalMinutes: number;
    normalWorkStartTime: string;
    normalWorkEndTime: string;
    overtimeMultiplier: number;
    offDayMultiplier: number;
    holidayMultiplier: number;
    lunchMinutes: number;
  };
  totals: ProgressClaimTotals;
  dailyWorkLog: DailyWorkLogItem[];
  photoEvidence: PhotoEvidenceSnapshotInput[];
  evidenceAudit: Array<{ message: string; eventAt: string; capturedAt?: string | null }>;
  signature: {
    workerSignature: string;
    clientAcknowledgement: string;
    signedAt: string;
  };
  disclaimer: string;
  localStorageNotice: string;
};
