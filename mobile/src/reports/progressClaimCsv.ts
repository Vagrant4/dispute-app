import type { ProgressClaimSnapshot } from "./progressClaimTypes";

export function buildProgressClaimCsv(snapshot: ProgressClaimSnapshot): string {
  const rows: string[][] = [
    ["Section", "Field", "Value"],
    ["Report", "Title", snapshot.title],
    ["Report", "Generated At", snapshot.generatedAt],
    ["Worker", "Name", snapshot.worker.name ?? ""],
    ["Worker", "Email", snapshot.worker.email ?? ""],
    ["Worker", "Phone", snapshot.worker.phone ?? ""],
    ["Client", "Name", snapshot.client.name ?? ""],
    ["Client", "Contact", snapshot.client.contactName ?? ""],
    ["Client", "Email", snapshot.client.contactEmail ?? ""],
    ["Project", "Name", snapshot.project.name ?? ""],
    ["Project", "Description", snapshot.project.description ?? ""],
    ["Claim Period", "Start", snapshot.claimPeriod.start],
    ["Claim Period", "End", snapshot.claimPeriod.end],
    ["Rate", "Currency", snapshot.rateCalculation.currency],
    ["Rate", "Hourly Rate Cents", String(snapshot.rateCalculation.hourlyRateCents)],
    ["Rate", "Daily Normal Minutes", String(snapshot.rateCalculation.dailyNormalMinutes)],
    ["Rate", "Overtime Multiplier", String(snapshot.rateCalculation.overtimeMultiplier)],
    ["Pay Summary", "Basic Pay Cents", String(snapshot.totals.basicPayCents)],
    ["Pay Summary", "OT Pay Cents", String(snapshot.totals.overtimePayCents)],
    ["Pay Summary", "Allowances Cents", String(snapshot.totals.allowancesCents)],
    ["Pay Summary", "Deductions Cents", String(snapshot.totals.deductionsCents)],
    ["Pay Summary", "Gross Pay Cents", String(snapshot.totals.grossPayCents)],
    ["Pay Summary", "Net Pay Cents", String(snapshot.totals.netPayCents)],
    ["Pay Summary", "Total Claim Amount Cents", String(snapshot.totals.totalClaimAmountCents)],
    [],
    ["Work Log", "Date", "Activity", "Normal Hours", "OT Hours", "Photo Evidence IDs"],
    ...snapshot.dailyWorkLog.map((item) => [
      "Work Log",
      item.workDate,
      item.activity,
      String(item.normalHours),
      String(item.overtimeHours),
      item.photoEvidenceIds.join(";"),
    ]),
    [],
    ["Photo Evidence", "ID", "Caption", "Type", "Captured At", "Local URI"],
    ...snapshot.photoEvidence.map((photo) => [
      "Photo Evidence",
      photo.id,
      photo.caption ?? "",
      photo.evidenceType ?? "",
      photo.capturedAt ?? "",
      photo.localUri,
    ]),
    [],
    ["Disclaimer", "Text", snapshot.disclaimer],
    ["Local Storage", "Notice", snapshot.localStorageNotice],
  ];

  return `${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")}\n`;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}
