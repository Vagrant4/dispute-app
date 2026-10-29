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
