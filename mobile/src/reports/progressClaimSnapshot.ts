import {
  LOCAL_REPORT_STORAGE_NOTICE,
  PROGRESS_CLAIM_DISCLAIMER,
  type DailyWorkLogItem,
  type PhotoEvidenceSnapshotInput,
  type ProgressClaimSnapshot,
  type ProgressClaimSnapshotInput,
  type TimeEntrySnapshotInput,
  type WorkLocationSnapshot,
} from "./progressClaimTypes";

const DEFAULT_DAILY_NORMAL_MINUTES = 8 * 60;
const DEFAULT_NORMAL_WORK_START_TIME = "08:00";
const DEFAULT_NORMAL_WORK_END_TIME = "17:00";
const DEFAULT_OVERTIME_MULTIPLIER = 1.5;
const DEFAULT_OFF_DAY_MULTIPLIER = 2;
const DEFAULT_HOLIDAY_MULTIPLIER = 2;
const DEFAULT_CURRENCY = "SGD";

export function buildProgressClaimSnapshot(
  input: ProgressClaimSnapshotInput,
): ProgressClaimSnapshot {
  const timeEntries = [...(input.timeEntries ?? [])].sort(compareTimeEntries);
  const photoEvidence = [...(input.photoEvidence ?? [])].sort(comparePhotoEvidence);
  const dailyNormalMinutes =
    input.pay?.dailyNormalMinutes ??
    calculateNormalWindowMinutes(
      input.pay?.normalWorkStartTime ?? DEFAULT_NORMAL_WORK_START_TIME,
      input.pay?.normalWorkEndTime ?? DEFAULT_NORMAL_WORK_END_TIME,
    );
  const normalWorkStartTime =
    input.pay?.normalWorkStartTime ?? DEFAULT_NORMAL_WORK_START_TIME;
  const normalWorkEndTime =
    input.pay?.normalWorkEndTime ?? DEFAULT_NORMAL_WORK_END_TIME;
  const overtimeMultiplier =
    input.pay?.overtimeMultiplier ?? DEFAULT_OVERTIME_MULTIPLIER;
  const offDayMultiplier =
    input.pay?.offDayMultiplier ?? DEFAULT_OFF_DAY_MULTIPLIER;
  const holidayMultiplier =
    input.pay?.holidayMultiplier ?? DEFAULT_HOLIDAY_MULTIPLIER;
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
    normalWorkStartTime,
    normalWorkEndTime,
  );
  const totalNormalMinutes = dailyWorkLog.reduce(
    (sum, item) => sum + Math.round(item.normalHours * 60),
    0,
  );
  const totalOvertimeMinutes = dailyWorkLog.reduce(
    (sum, item) => sum + Math.round(item.overtimeHours * 60),
    0,
  );
  const totalOffDayMinutes = dailyWorkLog.reduce(
    (sum, item) => sum + Math.round(item.offDayHours * 60),
    0,
  );
  const totalHolidayMinutes = dailyWorkLog.reduce(
    (sum, item) => sum + Math.round(item.holidayHours * 60),
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
  const offDayPayCents = calculatePayCents(
    totalOffDayMinutes,
    hourlyRateCents,
    offDayMultiplier,
  );
  const holidayPayCents = calculatePayCents(
    totalHolidayMinutes,
    hourlyRateCents,
    holidayMultiplier,
  );
  const grossPayCents =
    basicPayCents +
    overtimePayCents +
    offDayPayCents +
    holidayPayCents +
    allowancesCents;
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
      normalWorkStartTime,
      normalWorkEndTime,
      overtimeMultiplier,
      offDayMultiplier,
      holidayMultiplier,
    },
    totals: {
      totalDaysWorked: dailyWorkLog.length,
      totalNormalHours: minutesToHours(totalNormalMinutes),
      totalOvertimeHours: minutesToHours(totalOvertimeMinutes),
      totalOffDayHours: minutesToHours(totalOffDayMinutes),
      totalHolidayHours: minutesToHours(totalHolidayMinutes),
      basicPayCents,
      overtimePayCents,
      offDayPayCents,
      holidayPayCents,
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
  normalWorkStartTime: string,
  normalWorkEndTime: string,
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
      const normalEntries = entries.filter((entry) => getDayType(entry) === "normal");
      const normalDurationMinutes = normalEntries.reduce(
        (sum, entry) => sum + Math.max(0, entry.durationMinutes),
        0,
      );
      const { normalMinutes, overtimeMinutes } = splitNormalAndOvertimeMinutes(
        normalEntries,
        normalDurationMinutes,
        dailyNormalMinutes,
        normalWorkStartTime,
        normalWorkEndTime,
      );
      const offDayMinutes = sumDurationMinutesByDayType(entries, "off_day");
      const holidayMinutes = sumDurationMinutesByDayType(entries, "holiday");
      const dayTypes = [...new Set(entries.map((entry) => getDayType(entry)))];
      const locations = buildLocations(entries);
      const entryIds = new Set(entries.map((entry) => entry.id));
      const photoEvidenceIds = photoEvidence
        .filter((photo) => photo.timeEntryId && entryIds.has(photo.timeEntryId))
        .map((photo) => photo.id);

      return {
        workDate,
        activity: entries.map((entry) => entry.activity).join("; "),
        normalHours: minutesToHours(normalMinutes),
        overtimeHours: minutesToHours(overtimeMinutes),
        offDayHours: minutesToHours(offDayMinutes),
        holidayHours: minutesToHours(holidayMinutes),
        dayTypes,
        locations,
        durationMinutes,
        photoEvidenceIds,
      };
    });
}

function buildLocations(entries: TimeEntrySnapshotInput[]): WorkLocationSnapshot[] {
  const seen = new Set<string>();
  const locations: WorkLocationSnapshot[] = [];

  for (const entry of entries) {
    const address = entry.locationText?.trim();
    const latitude = entry.clockInGpsLatitude ?? entry.clockOutGpsLatitude ?? null;
    const longitude = entry.clockInGpsLongitude ?? entry.clockOutGpsLongitude ?? null;
    if (!address && (latitude == null || longitude == null)) {
      continue;
    }
    const displayAddress =
      address ||
      (latitude != null && longitude != null
        ? `GPS ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        : "");
    const key = `${displayAddress}|${latitude ?? ""}|${longitude ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    locations.push({
      address: displayAddress,
      latitude,
      longitude,
    });
  }

  return locations;
}

function sumDurationMinutesByDayType(
  entries: TimeEntrySnapshotInput[],
  dayType: "off_day" | "holiday",
): number {
  return entries
    .filter((entry) => getDayType(entry) === dayType)
    .reduce((sum, entry) => sum + Math.max(0, entry.durationMinutes), 0);
}

function getDayType(entry: TimeEntrySnapshotInput): "normal" | "off_day" | "holiday" {
  return entry.dayType === "off_day" || entry.dayType === "holiday"
    ? entry.dayType
    : "normal";
}

function splitNormalAndOvertimeMinutes(
  entries: TimeEntrySnapshotInput[],
  fallbackDurationMinutes: number,
  dailyNormalMinutes: number,
  normalWorkStartTime: string,
  normalWorkEndTime: string,
): { normalMinutes: number; overtimeMinutes: number } {
  const entriesWithTimes = entries.filter((entry) => entry.startTime && entry.endTime);
  if (entriesWithTimes.length === 0) {
    const normalMinutes = Math.min(fallbackDurationMinutes, dailyNormalMinutes);
    return {
      normalMinutes,
      overtimeMinutes: Math.max(0, fallbackDurationMinutes - normalMinutes),
    };
  }

  let normalMinutes = 0;
  let overtimeMinutes = 0;

  for (const entry of entriesWithTimes) {
    const durationMinutes = Math.max(0, entry.durationMinutes);
    const end = new Date(entry.endTime ?? "");
    const normalEnd = buildClockDate(entry.workDate, normalWorkEndTime);
    const normalStart = buildClockDate(entry.workDate, normalWorkStartTime);
    if (normalEnd <= normalStart) {
      normalEnd.setDate(normalEnd.getDate() + 1);
    }
    while (end < normalStart) {
      normalEnd.setDate(normalEnd.getDate() - 1);
      normalStart.setDate(normalStart.getDate() - 1);
    }
    const afterNormalEndMinutes = Math.max(
      0,
      Math.floor((end.getTime() - normalEnd.getTime()) / 60000),
    );
    const entryOvertimeMinutes = Math.min(durationMinutes, afterNormalEndMinutes);
    overtimeMinutes += entryOvertimeMinutes;
    normalMinutes += durationMinutes - entryOvertimeMinutes;
  }

  const missingTimedMinutes = entries
    .filter((entry) => !entry.startTime || !entry.endTime)
    .reduce((sum, entry) => sum + Math.max(0, entry.durationMinutes), 0);
  if (missingTimedMinutes > 0) {
    const normalRoom = Math.max(0, dailyNormalMinutes - normalMinutes);
    const normalFallbackMinutes = Math.min(missingTimedMinutes, normalRoom);
    normalMinutes += normalFallbackMinutes;
    overtimeMinutes += missingTimedMinutes - normalFallbackMinutes;
  }

  return { normalMinutes, overtimeMinutes };
}

function buildClockDate(workDate: string, clockTime: string): Date {
  const [hour, minute] = clockTime.split(":").map((value) => Number.parseInt(value, 10));
  return new Date(`${workDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`);
}

function calculateNormalWindowMinutes(startTime: string, endTime: string): number {
  const start = minutesOfDay(startTime);
  let end = minutesOfDay(endTime);
  if (end <= start) {
    end += 24 * 60;
  }
  return end - start || DEFAULT_DAILY_NORMAL_MINUTES;
}

function minutesOfDay(clockTime: string): number {
  const [hourText, minuteText] = clockTime.split(":");
  const hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText, 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return 0;
  }
  return hour * 60 + minute;
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
