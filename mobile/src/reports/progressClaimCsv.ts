import type { ProgressClaimSnapshot } from "./progressClaimTypes";

export function buildProgressClaimCsv(snapshot: ProgressClaimSnapshot): string {
  const payValue = (value: number) => snapshot.rateCalculation.hourlyRateCents > 0 ? String(value) : "Rate not set";
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
    ["Rate", "Hourly Rate Cents", snapshot.rateCalculation.hourlyRateCents > 0 ? String(snapshot.rateCalculation.hourlyRateCents) : "Rate not set"],
    ["Rate", "Normal Work Start", snapshot.rateCalculation.normalWorkStartTime],
    ["Rate", "Normal Work End", snapshot.rateCalculation.normalWorkEndTime],
    ["Rate", "Daily Normal Minutes", String(snapshot.rateCalculation.dailyNormalMinutes)],
    ["Rate", "Overtime Multiplier", String(snapshot.rateCalculation.overtimeMultiplier)],
    ["Rate", "Off Day Multiplier", String(snapshot.rateCalculation.offDayMultiplier)],
    ["Rate", "Holiday Multiplier", String(snapshot.rateCalculation.holidayMultiplier)],
    ["Rate", "OT Rule", `OT starts after ${snapshot.rateCalculation.normalWorkEndTime}`],
    ["Rate", "Special Day Rule", "Off day and holiday entries apply their multiplier to all recorded hours."],
    ["Pay Summary", "Basic Pay Cents", payValue(snapshot.totals.basicPayCents)],
    ["Pay Summary", "OT Pay Cents", payValue(snapshot.totals.overtimePayCents)],
    ["Pay Summary", "Off Day Pay Cents", payValue(snapshot.totals.offDayPayCents)],
    ["Pay Summary", "Holiday Pay Cents", payValue(snapshot.totals.holidayPayCents)],
    ["Pay Summary", "Allowances Cents", String(snapshot.totals.allowancesCents)],
    ["Pay Summary", "Gross Pay Cents", payValue(snapshot.totals.grossPayCents)],
    ["Pay Summary", "Net Pay Cents", payValue(snapshot.totals.netPayCents)],
    ["Pay Summary", "Total Claim Amount Cents", payValue(snapshot.totals.totalClaimAmountCents)],
    [],
    ["Work Log", "Date", "Day Type", "Activity", "Location", "Normal Hours", "OT Hours", "Off Day Hours", "Holiday Hours", "Photo Evidence IDs", "start_source", "stop_source", "start_accuracy_m", "stop_accuracy_m", "location_note", "start_lat", "start_lng", "stop_lat", "stop_lng"],
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
      ...( ["clockInLocationSource", "clockOutLocationSource", "clockInGpsAccuracyM", "clockOutGpsAccuracyM", "locationNote"] as const).map((field) => (item.locationEntries ?? []).map((entry) => String(entry[field] ?? (field.endsWith("Source") ? "legacy" : ""))).join(";")),
      ...(["clockInGpsLatitude", "clockInGpsLongitude", "clockOutGpsLatitude", "clockOutGpsLongitude"] as const).map((field) => (item.locationEntries ?? []).map((entry) => String(entry[field] ?? "")).join(";")),
    ]),
    ...snapshot.dailyWorkLog.flatMap((item) => (item.locationEntries ?? []).flatMap((entry) => (entry.taskSegments ?? []).map((segment) => ["Task Segment", item.workDate, segment.taskName, segment.start, segment.end, String(segment.durationMinutes), entry.locationNote ?? "", String(entry.breakMinutes ?? 0)]))),
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
    ["Evidence Audit", "Event", "Event At", "Captured At", "Chain Status"],
    ...(snapshot.evidenceAudit ?? []).map((event) => ["Evidence Audit", event.message, event.eventAt, event.capturedAt ?? "", `1 item deleted by user at ${event.eventAt}`]),
    [],
    ["Disclaimer", "Text", snapshot.disclaimer],
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
