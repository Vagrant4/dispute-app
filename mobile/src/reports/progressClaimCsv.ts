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
    ["Rate", "Normal Work Start", snapshot.rateCalculation.normalWorkStartTime],
    ["Rate", "Normal Work End", snapshot.rateCalculation.normalWorkEndTime],
    ["Rate", "Daily Normal Minutes", String(snapshot.rateCalculation.dailyNormalMinutes)],
    ["Rate", "Overtime Multiplier", String(snapshot.rateCalculation.overtimeMultiplier)],
    ["Rate", "Off Day Multiplier", String(snapshot.rateCalculation.offDayMultiplier)],
    ["Rate", "Holiday Multiplier", String(snapshot.rateCalculation.holidayMultiplier)],
    ["Rate", "OT Rule", `OT starts after ${snapshot.rateCalculation.normalWorkEndTime}`],
    ["Rate", "Special Day Rule", "Off day and holiday entries apply their multiplier to all recorded hours."],
    ["Pay Summary", "Basic Pay Cents", String(snapshot.totals.basicPayCents)],
    ["Pay Summary", "OT Pay Cents", String(snapshot.totals.overtimePayCents)],
    ["Pay Summary", "Off Day Pay Cents", String(snapshot.totals.offDayPayCents)],
    ["Pay Summary", "Holiday Pay Cents", String(snapshot.totals.holidayPayCents)],
    ["Pay Summary", "Allowances Cents", String(snapshot.totals.allowancesCents)],
    ["Pay Summary", "Gross Pay Cents", String(snapshot.totals.grossPayCents)],
    ["Pay Summary", "Net Pay Cents", String(snapshot.totals.netPayCents)],
    ["Pay Summary", "Total Claim Amount Cents", String(snapshot.totals.totalClaimAmountCents)],
    [],
    ["Work Log", "Date", "Day Type", "Activity", "Location", "Normal Hours", "OT Hours", "Off Day Hours", "Holiday Hours", "Photo Evidence IDs"],
    ...snapshot.dailyWorkLog.map((item) => [
      "Work Log",
      item.workDate,
      item.dayTypes.join(";"),
      item.activity,
      formatLocations(item.locations),
      String(item.normalHours),
      String(item.overtimeHours),
      String(item.offDayHours),
      String(item.holidayHours),
      item.photoEvidenceIds.join(";"),
    ]),
    [],
    ["Photo Evidence", "Photo Evidence ID", "Linked Time Entry ID", "Caption", "Type", "Captured At", "Local URI"],
    ...snapshot.photoEvidence.map((photo) => [
      "Photo Evidence",
      photo.id,
      photo.timeEntryId ?? "",
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

function formatLocations(
  locations: Array<{ address: string; latitude: number | null; longitude: number | null }>,
): string {
  return locations
    .map((location) => {
      const coordinates =
        location.latitude != null && location.longitude != null
          ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
          : "";
      return coordinates ? `${location.address} (${coordinates})` : location.address;
    })
    .join(";");
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}
