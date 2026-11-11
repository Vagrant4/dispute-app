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
  const normalWorkStartTime =
    input.pay?.normalWorkStartTime ?? DEFAULT_NORMAL_WORK_START_TIME;
  const normalWorkEndTime =
    input.pay?.normalWorkEndTime ?? DEFAULT_NORMAL_WORK_END_TIME;
  const normalRangeMinutes = calculateNormalWindowMinutes(normalWorkStartTime, normalWorkEndTime);
  const lunchMinutes = Math.max(0, input.pay?.lunchMinutes ?? 0);
  const dailyNormalMinutes = Math.max(0, (input.pay?.dailyNormalMinutes ?? normalRangeMinutes) - lunchMinutes);
  const overtimeMultiplier =
    input.pay?.overtimeMultiplier ?? DEFAULT_OVERTIME_MULTIPLIER;
  const offDayMultiplier =
    input.pay?.offDayMultiplier ?? DEFAULT_OFF_DAY_MULTIPLIER;
  const holidayMultiplier =
    input.pay?.holidayMultiplier ?? DEFAULT_HOLIDAY_MULTIPLIER;
  const rateBasis = input.pay?.rateBasis ?? "hourly";
  const baseRateCents = input.pay?.baseRateCents ?? input.pay?.hourlyRateCents ?? 0;
  // Daily rates stay as integer cents until each day's pay is rounded to cents.
  const hourlyRateCents = rateBasis === "daily"
    ? Math.round(baseRateCents / (normalRangeMinutes / 60))
    : input.pay?.hourlyRateCents ?? baseRateCents;
  const currency =
    input.pay?.currency ??
    input.project?.currency ??
    DEFAULT_CURRENCY;

  const dailyWorkLog = buildDailyWorkLog(
    timeEntries,
    photoEvidence,
    dailyNormalMinutes,
    normalWorkStartTime,
    normalWorkEndTime, lunchMinutes,
  );
  const paidDailyWorkLog = dailyWorkLog.map((day) => addDailyPay(day, {
    rateBasis, baseRateCents, hourlyRateCents, normalRangeMinutes,
    overtimeMultiplier, offDayMultiplier, holidayMultiplier,
  }));
  const totalNormalMinutes = paidDailyWorkLog.reduce(
    (sum, item) => sum + Math.round(item.normalHours * 60),
    0,
  );
  const totalOvertimeMinutes = paidDailyWorkLog.reduce(
    (sum, item) => sum + Math.round(item.overtimeHours * 60),
    0,
  );
  const totalOffDayMinutes = paidDailyWorkLog.reduce(
    (sum, item) => sum + Math.round(item.offDayHours * 60),
    0,
  );
  const totalHolidayMinutes = paidDailyWorkLog.reduce(
    (sum, item) => sum + Math.round(item.holidayHours * 60),
    0,
  );
  const allowancesCents = input.pay?.allowancesCents ?? 0;
  const deductionsCents = input.pay?.deductionsCents ?? 0;
  // Summary is the sum of the rounded per-day cents shown in the work log.
  const basicPayCents = paidDailyWorkLog.reduce((sum, day) => sum + day.basicPayCents, 0);
  const overtimePayCents = paidDailyWorkLog.reduce((sum, day) => sum + day.overtimePayCents, 0);
  const offDayPayCents = paidDailyWorkLog.reduce((sum, day) => sum + day.offDayPayCents, 0);
  const holidayPayCents = paidDailyWorkLog.reduce((sum, day) => sum + day.holidayPayCents, 0);
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
      rateBasis,
      baseRateCents,
      dailyNormalMinutes,
      normalWorkStartTime,
      normalWorkEndTime,
      overtimeMultiplier,
      offDayMultiplier,
      holidayMultiplier,
      lunchMinutes,
    },
    totals: {
      totalDaysWorked: paidDailyWorkLog.length,
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
    dailyWorkLog: paidDailyWorkLog,
    photoEvidence,
    evidenceAudit: input.evidenceAudit ?? [],
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
  lunchMinutes: number,
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
      const split = splitNormalAndOvertimeMinutes(
        normalEntries,
        normalDurationMinutes,
        dailyNormalMinutes,
        normalWorkStartTime,
        normalWorkEndTime,
      );
      const deduction = shouldDeductLunch(entries, lunchMinutes, workDate, normalWorkStartTime, normalWorkEndTime) ? lunchMinutes : 0;
      // Report-only lunch deduction: normal minutes first, then OT, before special-day multipliers.
      const normalMinutes = Math.max(0, split.normalMinutes - deduction);
      const overtimeMinutes = Math.max(0, split.overtimeMinutes - Math.max(0, deduction - split.normalMinutes));
      const offDayMinutes = Math.max(0, sumDurationMinutesByDayType(entries, "off_day") - deduction);
      const holidayMinutes = Math.max(0, sumDurationMinutesByDayType(entries, "holiday") - deduction);
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
        locationEntries: entries,
        durationMinutes,
        photoEvidenceIds,
        basicPayCents: 0,
        overtimePayCents: 0,
        offDayPayCents: 0,
        holidayPayCents: 0,
        grossPayCents: 0,
        lunchDeductedMinutes: deduction,
      };
    });
}

function shouldDeductLunch(entries: TimeEntrySnapshotInput[], lunchMinutes: number, workDate: string, startTime: string, endTime: string): boolean {
  if (!lunchMinutes) return false;
  const timed = entries.flatMap((entry) => {
    if (!entry.startTime || !entry.endTime) return [];
    const start = new Date(entry.startTime).getTime(); const end = new Date(entry.endTime).getTime();
    return Number.isFinite(start) && end > start ? [[start, end] as [number, number]] : [];
  }).sort((a, b) => a[0] - b[0]);
  if (!timed.length) return false;
  const merged: Array<[number, number]> = [];
  for (const interval of timed) { const previous = merged.at(-1); if (previous && interval[0] <= previous[1]) previous[1] = Math.max(previous[1], interval[1]); else merged.push([...interval]); }
  const first = merged[0][0], last = merged[merged.length - 1][1];
  const total = merged.reduce((sum, [start, end]) => sum + (end - start) / 60000, 0);
  const offset = entries.find((entry) => entry.startTime?.match(/(?:Z|[+-]\d\d:\d\d)$/))?.startTime?.match(/(?:Z|[+-]\d\d:\d\d)$/)?.[0] ?? "";
  const rangeStart = new Date(`${workDate}T${startTime}:00${offset}`).getTime();
  const rangeEnd = new Date(`${workDate}T${endTime}:00${offset}`).getTime();
  const lunchStart = rangeStart + Math.floor((rangeEnd - rangeStart - lunchMinutes * 60000) / 2);
  const lunchEnd = lunchStart + lunchMinutes * 60000;
  const coversWindow = merged.some(([start, end]) => start <= lunchStart && end >= lunchEnd);
  return coversWindow || (total > lunchMinutes + 240 && (last - first) / 60000 >= lunchMinutes);
}

function addDailyPay(
  day: DailyWorkLogItem,
  rate: {
    rateBasis: "daily" | "monthly" | "hourly";
    baseRateCents: number;
    hourlyRateCents: number;
    normalRangeMinutes: number;
    overtimeMultiplier: number;
    offDayMultiplier: number;
    holidayMultiplier: number;
  },
): DailyWorkLogItem {
  const pay = (hours: number, multiplier: number) => {
    const minutes = Math.round(hours * 60);
    return rate.rateBasis === "daily"
      ? Math.round((minutes * rate.baseRateCents * multiplier) / rate.normalRangeMinutes)
      : calculatePayCents(minutes, rate.hourlyRateCents, multiplier);
  };
  const basicPayCents = pay(day.normalHours, 1);
  const overtimePayCents = pay(day.overtimeHours, rate.overtimeMultiplier);
  const offDayPayCents = pay(day.offDayHours, rate.offDayMultiplier);
  const holidayPayCents = pay(day.holidayHours, rate.holidayMultiplier);
  return {
    ...day,
    basicPayCents,
    overtimePayCents,
    offDayPayCents,
    holidayPayCents,
    grossPayCents: basicPayCents + overtimePayCents + offDayPayCents + holidayPayCents,
  };
}

function buildLocations(entries: TimeEntrySnapshotInput[]): WorkLocationSnapshot[] {
  const seen = new Set<string>();
  const locations: WorkLocationSnapshot[] = [];

  function add(address: string, latitude: number | null, longitude: number | null, source: WorkLocationSnapshot["source"], accuracy?: number | null, locatedAt?: string | null, phase?: string) {
    const label = source === "gps" ? `${address || "GPS point (no street name)"} · GPS ${accuracy == null ? "accuracy unknown" : `±${Math.round(accuracy)} m`}${accuracy != null && accuracy > 50 ? " · approximate" : ""}${locatedAt ? ` · ${locatedAt}` : ""}`
      : source === "none" ? "No GPS fix (location off)"
      : `${address ? `${address} · ` : ""}Source not recorded (older record)`;
    const key = `${address}|${latitude ?? ""}|${longitude ?? ""}|${source ?? ""}${phase?.endsWith("refresh") ? `|${locatedAt}` : ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    locations.push({ siteAddress: address, address: label, latitude, longitude, source, accuracy, locatedAt, phase });
  }
  for (const entry of entries) {
    const phases = [
      { address: entry.locationText, latitude: entry.clockInGpsLatitude, longitude: entry.clockInGpsLongitude, source: entry.clockInLocationSource, accuracy: entry.clockInGpsAccuracyM, locatedAt: entry.clockInLocatedAt, phase: "start" },
      { address: entry.clockOutLocationText, latitude: entry.clockOutGpsLatitude, longitude: entry.clockOutGpsLongitude, source: entry.clockOutLocationSource, accuracy: entry.clockOutGpsAccuracyM, locatedAt: entry.clockOutLocatedAt, phase: "stop" },
    ];
    for (const fix of phases) {
      if (!fix.source && !fix.address && fix.latitude == null && fix.longitude == null) continue;
      add(fix.address?.trim() || "", fix.latitude ?? null, fix.longitude ?? null, fix.source ?? "legacy", fix.accuracy, fix.locatedAt, fix.phase);
    }
    if (!phases.some((fix) => fix.source || fix.address || fix.latitude != null)) add("", null, null, "legacy");
    if (entry.locationHistoryJson) {
      const history = JSON.parse(entry.locationHistoryJson) as import("../work/locationEvidence").LocationReading[];
      for (const fix of history) add(fix.address || "", fix.latitude, fix.longitude, fix.source, fix.accuracy, fix.locatedAt, `${fix.phase} refresh`);
    }
    if (entry.locationNote?.trim()) locations.push({ address: `Typed by worker, not GPS: ${entry.locationNote.trim()}`, latitude: null, longitude: null });
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
