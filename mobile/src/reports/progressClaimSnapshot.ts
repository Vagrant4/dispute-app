import {
  LOCAL_REPORT_STORAGE_NOTICE,
  PROGRESS_CLAIM_DISCLAIMER,
  type DailyWorkLogItem,
  type PhotoEvidenceSnapshotInput,
  type ProgressClaimSnapshot,
  type ProgressClaimSnapshotInput,
  type TimeEntrySnapshotInput,
} from "./progressClaimTypes";

const DEFAULT_DAILY_NORMAL_MINUTES = 8 * 60;
const DEFAULT_OVERTIME_MULTIPLIER = 1.5;
const DEFAULT_CURRENCY = "SGD";

export function buildProgressClaimSnapshot(
  input: ProgressClaimSnapshotInput,
): ProgressClaimSnapshot {
  const timeEntries = [...(input.timeEntries ?? [])].sort(compareTimeEntries);
  const photoEvidence = [...(input.photoEvidence ?? [])].sort(comparePhotoEvidence);
  const dailyNormalMinutes =
    input.pay?.dailyNormalMinutes ?? DEFAULT_DAILY_NORMAL_MINUTES;
  const overtimeMultiplier =
    input.pay?.overtimeMultiplier ?? DEFAULT_OVERTIME_MULTIPLIER;
  const hourlyRateCents =
    input.pay?.hourlyRateCents ??
    input.project?.hourlyRateCents ??
    0;
  const currency =
    input.pay?.currency ??
    input.project?.currency ??
    DEFAULT_CURRENCY;

  const dailyWorkLog = buildDailyWorkLog(
    timeEntries,
    photoEvidence,
    dailyNormalMinutes,
  );
  const totalNormalMinutes = dailyWorkLog.reduce(
    (sum, item) => sum + Math.round(item.normalHours * 60),
    0,
  );
  const totalOvertimeMinutes = dailyWorkLog.reduce(
    (sum, item) => sum + Math.round(item.overtimeHours * 60),
    0,
  );
  const allowancesCents = input.pay?.allowancesCents ?? 0;
  const deductionsCents = input.pay?.deductionsCents ?? 0;
  const basicPayCents = calculatePayCents(totalNormalMinutes, hourlyRateCents, 1);
  const overtimePayCents = calculatePayCents(
    totalOvertimeMinutes,
    hourlyRateCents,
    overtimeMultiplier,
  );
  const grossPayCents = basicPayCents + overtimePayCents + allowancesCents;
  const netPayCents = grossPayCents - deductionsCents;

  return {
    title: "Progress Claim Report",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    claimPeriod: input.claimPeriod ?? inferClaimPeriod(timeEntries),
    worker: input.worker ?? {},
    client: input.client ?? {},
    project: {
      ...(input.project ?? {}),
      currency,
    },
    rateCalculation: {
      currency,
      hourlyRateCents,
      dailyNormalMinutes,
      overtimeMultiplier,
    },
    totals: {
      totalDaysWorked: dailyWorkLog.length,
      totalNormalHours: minutesToHours(totalNormalMinutes),
      totalOvertimeHours: minutesToHours(totalOvertimeMinutes),
      basicPayCents,
      overtimePayCents,
      allowancesCents,
      deductionsCents,
      grossPayCents,
      netPayCents,
      totalClaimAmountCents: netPayCents,
    },
    dailyWorkLog,
    photoEvidence,
    signature: {
      workerSignature: "",
      clientAcknowledgement: "",
      signedAt: "",
    },
    disclaimer: PROGRESS_CLAIM_DISCLAIMER,
    localStorageNotice: LOCAL_REPORT_STORAGE_NOTICE,
  };
}

function buildDailyWorkLog(
  timeEntries: TimeEntrySnapshotInput[],
  photoEvidence: PhotoEvidenceSnapshotInput[],
  dailyNormalMinutes: number,
): DailyWorkLogItem[] {
  const entriesByDate = new Map<string, TimeEntrySnapshotInput[]>();

  for (const entry of timeEntries) {
    const existing = entriesByDate.get(entry.workDate) ?? [];
    existing.push(entry);
    entriesByDate.set(entry.workDate, existing);
  }

  return [...entriesByDate.entries()]
    .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
    .map(([workDate, entries]) => {
      const durationMinutes = entries.reduce(
        (sum, entry) => sum + Math.max(0, entry.durationMinutes),
        0,
      );
      const normalMinutes = Math.min(durationMinutes, dailyNormalMinutes);
      const overtimeMinutes = Math.max(0, durationMinutes - dailyNormalMinutes);
      const entryIds = new Set(entries.map((entry) => entry.id));
      const photoEvidenceIds = photoEvidence
        .filter((photo) => photo.timeEntryId && entryIds.has(photo.timeEntryId))
        .map((photo) => photo.id);

      return {
        workDate,
        activity: entries.map((entry) => entry.activity).join("; "),
        normalHours: minutesToHours(normalMinutes),
        overtimeHours: minutesToHours(overtimeMinutes),
        durationMinutes,
        photoEvidenceIds,
      };
    });
}

function inferClaimPeriod(timeEntries: TimeEntrySnapshotInput[]): {
  start: string;
  end: string;
} {
  if (timeEntries.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    return { start: today, end: today };
  }

  const dates = timeEntries.map((entry) => entry.workDate).sort();
  return {
    start: dates[0],
    end: dates[dates.length - 1],
  };
}

function calculatePayCents(
  minutes: number,
  hourlyRateCents: number,
  multiplier: number,
): number {
  return Math.round((minutes / 60) * hourlyRateCents * multiplier);
}

function minutesToHours(minutes: number): number {
  return Number((minutes / 60).toFixed(2));
}

function compareTimeEntries(
  first: TimeEntrySnapshotInput,
  second: TimeEntrySnapshotInput,
): number {
  return (
    first.workDate.localeCompare(second.workDate) ||
    first.id.localeCompare(second.id)
  );
}

function comparePhotoEvidence(
  first: PhotoEvidenceSnapshotInput,
  second: PhotoEvidenceSnapshotInput,
): number {
  return (
    (first.capturedAt ?? "").localeCompare(second.capturedAt ?? "") ||
    first.id.localeCompare(second.id)
  );
}
