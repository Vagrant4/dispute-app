import { buildProgressClaimSnapshot } from "./progressClaimSnapshot";
import type { ProgressClaimSnapshotInput } from "./progressClaimTypes";

export function buildProjectWeekReport(params: {
  input: ProgressClaimSnapshotInput;
  weekStart: string;
  accountName?: string;
  reportName?: string;
}) {
  const end = new Date(`${params.weekStart}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  const weekEnd = end.toISOString().slice(0, 10);
  const inWeek = (date: string) => date >= params.weekStart && date <= weekEnd;
  return buildProgressClaimSnapshot({
    ...params.input,
    claimPeriod: { start: params.weekStart, end: weekEnd },
    worker: { name: params.accountName?.trim() || params.reportName?.trim() || "Worker" },
    timeEntries: params.input.timeEntries?.filter((entry) => inWeek(entry.workDate)),
    photoEvidence: params.input.photoEvidence?.filter((photo) => !photo.capturedAt || inWeek(photo.capturedAt.slice(0, 10))),
  });
}

export function buildProjectPeriodReport(params: {
  input: ProgressClaimSnapshotInput;
  periodStart: string;
  periodEnd: string;
  accountName?: string;
  reportName?: string;
}) {
  const inPeriod = (date: string) => date >= params.periodStart && date <= params.periodEnd;
  return buildProgressClaimSnapshot({
    ...params.input,
    claimPeriod: { start: params.periodStart, end: params.periodEnd },
    worker: { name: params.accountName?.trim() || params.reportName?.trim() || "Worker" },
    timeEntries: params.input.timeEntries?.filter((entry) => inPeriod(entry.workDate)),
    photoEvidence: params.input.photoEvidence?.filter((photo) => !photo.capturedAt || inPeriod(photo.capturedAt.slice(0, 10))),
  });
}
