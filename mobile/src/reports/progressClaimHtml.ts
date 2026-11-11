import type { ProgressClaimSnapshot } from "./progressClaimTypes";
import { projectAddressLabel } from "../work/projectAddress";

export function buildProgressClaimHtml(snapshot: ProgressClaimSnapshot): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(snapshot.title)}</title>
  <style>
    @page { margin: 18mm 14mm; size: A4; }
    * { box-sizing: border-box; }
    body { color: #17233b; font-family: Arial, sans-serif; line-height: 1.4; margin: 0; }
    h1 { color: #ffffff; font-size: 28px; letter-spacing: .3px; margin: 0 0 8px; }
    h2 { border-bottom: 2px solid #2f6fed; color: #102447; font-size: 18px; margin-top: 28px; padding-bottom: 6px; page-break-after: avoid; }
    table { border-collapse: collapse; margin-top: 10px; table-layout: fixed; width: 100%; }
    th, td { border: 1px solid #d5e2de; font-size: 12px; overflow-wrap: normal; padding: 8px; text-align: left; vertical-align: top; word-break: normal; }
    .short-cell { white-space: nowrap; }
    .long-token { overflow-wrap: break-word; word-break: normal; }
    th { background: #edf4ff; color: #102447; }
    tr, .report-section { page-break-inside: avoid; }
    thead { display: table-header-group; }
    .muted { color: #62708a; font-size: 12px; }
    .report-header { background: #102447; border-bottom: 6px solid #f2a900; margin: -18mm -14mm 24px; padding: 20mm 14mm 16px; }
    .report-header .muted { color: #dce7fb; margin: 0; }
    .claim-highlight { background: #edf4ff; border-left: 6px solid #f2a900; display: grid; gap: 8px; grid-template-columns: repeat(3, 1fr); margin: 0 0 20px; padding: 14px; page-break-inside: avoid; }
    .claim-highlight strong { color: #102447; display: block; font-size: 18px; }
    .claim-highlight span { color: #62708a; font-size: 11px; text-transform: uppercase; }
    .gps-appendix { color: #62708a; font-size: 10px; }
    .photo-card { border: 1px solid #d5e2de; border-radius: 12px; margin-top: 10px; page-break-inside: avoid; }
    .daily-log-card { border: 1px solid #d5e2de; border-radius: 12px; margin-top: 10px; page-break-inside: avoid; }
    .daily-log-card { padding: 10px; }
    .daily-log-date { display: block; font-weight: 700; margin-bottom: 8px; }
    .daily-log-copy { margin: 4px 0; }
    .daily-log-grid { display: grid; gap: 4px 12px; grid-template-columns: repeat(3, 1fr); margin-top: 8px; }
    .photo-card-header { background: #edf4ff; border-left: 5px solid #f2a900; color: #102447; font-size: 12px; font-weight: 700; padding: 8px 10px; }
    .photo-card-body { display: grid; gap: 10px; grid-template-columns: 150px 1fr; padding: 10px; }
    .photo-thumb { border: 1px solid #d5e2de; border-radius: 8px; max-height: 120px; max-width: 150px; object-fit: cover; }
    .photo-placeholder { align-items: center; background: #f6fbfa; border: 1px dashed #b9d8d2; border-radius: 8px; color: #5a6b67; display: flex; font-size: 11px; justify-content: center; min-height: 90px; padding: 8px; text-align: center; }
  </style>
</head>
<body>
  <header class="report-header">
    <h1>${escapeHtml(snapshot.title)}</h1>
    <p class="muted">Generated ${escapeHtml(formatLocalDateTime(snapshot.generatedAt))}</p>
  </header>

  <section class="claim-highlight" aria-label="Claim overview">
    <div><span>Total claim amount</span><strong>${escapeHtml(snapshot.rateCalculation.hourlyRateCents > 0 ? formatMoney(snapshot.totals.totalClaimAmountCents, snapshot.rateCalculation.currency) : "Rate not set")}</strong></div>
    <div><span>Days worked</span><strong>${snapshot.totals.totalDaysWorked}</strong></div>
    <div><span>Claim period</span><strong>${escapeHtml(formatDate(snapshot.claimPeriod.start))} &ndash; ${escapeHtml(formatDate(snapshot.claimPeriod.end))}</strong></div>
  </section>

  <h2>Worker Profile</h2>
  ${detailsTable([
    ["Name", snapshot.worker.name],
    ["Email", snapshot.worker.email],
    ["Phone", snapshot.worker.phone],
  ])}

  <h2>Client / Company</h2>
  ${detailsTable([
    ["Name", snapshot.client.name],
    ["Contact", snapshot.client.contactName],
    ["Email", snapshot.client.contactEmail],
  ])}

  <h2>Project Details</h2>
  ${detailsTable([
    ["Project", snapshot.project.name],
    ["Site", projectAddressLabel(snapshot.project.siteAddress)],
    ["Description", snapshot.project.description],
    ["Currency", snapshot.project.currency],
  ])}

  <h2>Claim Period</h2>
  ${detailsTable([
    ["Start", formatDate(snapshot.claimPeriod.start)],
    ["End", formatDate(snapshot.claimPeriod.end)],
  ])}

  <h2>Rate Calculation</h2>
  ${detailsTable([
    ["Hourly rate", snapshot.rateCalculation.hourlyRateCents > 0 ? `${formatMoney(snapshot.rateCalculation.hourlyRateCents, snapshot.rateCalculation.currency)}/h` : "Rate not set"],
    ["Entered rate", formatEnteredRate(snapshot)],
    ["Normal working time", `${snapshot.rateCalculation.normalWorkStartTime} - ${snapshot.rateCalculation.normalWorkEndTime}`],
    ["Normal hours from range", formatHoursAndMinutes(snapshot.rateCalculation.dailyNormalMinutes)],
    ["Lunch deduction", snapshot.rateCalculation.lunchMinutes ? `${formatLunch(snapshot.rateCalculation.lunchMinutes)}, window ${lunchWindow(snapshot.rateCalculation.normalWorkStartTime, snapshot.rateCalculation.normalWorkEndTime, snapshot.rateCalculation.lunchMinutes)}; deducted when the clocked time covers the window or the day is longer than lunch + 4 h` : "None"],
    ["Overtime multiplier", String(snapshot.rateCalculation.overtimeMultiplier)],
    ["Off day multiplier", String(snapshot.rateCalculation.offDayMultiplier)],
    ["Holiday multiplier", String(snapshot.rateCalculation.holidayMultiplier)],
    ["OT rule", `OT starts after ${snapshot.rateCalculation.normalWorkEndTime}`],
    ["Special day rule", "Off day and holiday entries apply their multiplier to all recorded hours."],
  ])}

  <h2>Pay Summary</h2>
  ${detailsTable([
    ["Days worked", String(snapshot.totals.totalDaysWorked)],
    ["Normal hours", formatHoursAndMinutes(snapshot.totals.totalNormalMinutes)],
    ["Overtime hours", formatHoursAndMinutes(snapshot.totals.totalOvertimeMinutes)],
    ["Off day hours", formatHoursAndMinutes(snapshot.totals.totalOffDayMinutes)],
    ["Holiday hours", formatHoursAndMinutes(snapshot.totals.totalHolidayMinutes)],
    ["Basic pay", snapshot.rateCalculation.hourlyRateCents > 0 ? formatMoney(snapshot.totals.basicPayCents, snapshot.rateCalculation.currency) : "Rate not set"],
    ["OT pay", snapshot.rateCalculation.hourlyRateCents > 0 ? formatMoney(snapshot.totals.overtimePayCents, snapshot.rateCalculation.currency) : "Rate not set"],
    ["Off day pay", snapshot.rateCalculation.hourlyRateCents > 0 ? formatMoney(snapshot.totals.offDayPayCents, snapshot.rateCalculation.currency) : "Rate not set"],
    ["Holiday pay", snapshot.rateCalculation.hourlyRateCents > 0 ? formatMoney(snapshot.totals.holidayPayCents, snapshot.rateCalculation.currency) : "Rate not set"],
    ["Allowances", formatMoney(snapshot.totals.allowancesCents, snapshot.rateCalculation.currency)],
    ["Gross pay", snapshot.rateCalculation.hourlyRateCents > 0 ? formatMoney(snapshot.totals.grossPayCents, snapshot.rateCalculation.currency) : "Rate not set"],
    ["Net pay", snapshot.rateCalculation.hourlyRateCents > 0 ? formatMoney(snapshot.totals.netPayCents, snapshot.rateCalculation.currency) : "Rate not set"],
    ["Total claim amount", snapshot.rateCalculation.hourlyRateCents > 0 ? formatMoney(snapshot.totals.totalClaimAmountCents, snapshot.rateCalculation.currency) : "Rate not set"],
  ])}

  <h2>Daily Work Log</h2>
  ${snapshot.dailyWorkLog.map((item) => dailyLogCard(item, snapshot.rateCalculation.currency, snapshot.rateCalculation.hourlyRateCents)).join("")}
  ${dailyTotalsCard(snapshot)}

  <h2>Shift evidence</h2>
  <table><colgroup><col style="width:18%"><col style="width:32%"><col style="width:15%"><col style="width:35%"></colgroup><thead><tr><th>Date</th><th>Note</th><th>Break</th><th>Task segments</th></tr></thead><tbody>${snapshot.dailyWorkLog.flatMap((day) => (day.locationEntries ?? []).map((entry) => `<tr><td class="short-cell">${escapeHtml(formatDate(day.workDate))}</td><td>${escapeHtml(entry.locationNote ?? "")}</td><td class="short-cell">${entry.breakMinutes ?? 0} min</td><td>${escapeHtml((entry.taskSegments ?? []).map((segment) => `${segment.taskName}: ${segment.start} - ${segment.end} (${segment.durationMinutes} min)`).join("; "))}</td></tr>`)).join("")}</tbody></table>

  <h2>Work sites</h2>
  ${buildWorkSites(snapshot)}

  <h2>Evidence Audit</h2>
  <p>${snapshot.evidenceAudit?.length ? snapshot.evidenceAudit.map((event) => `${escapeHtml(event.message)} — sealed chain status: 1 item deleted by user at ${escapeHtml(event.eventAt)}`).join("<br>") : "No evidence deletion events."}</p>
  <h2>Photo Evidence</h2>
  <table><colgroup><col style="width:26%"><col style="width:20%"><col style="width:14%"><col style="width:20%"><col style="width:20%"></colgroup>
    <thead><tr><th>Photo Evidence ID</th><th>Linked Time Entry ID</th><th>Type</th><th>Caption</th><th>Captured at</th></tr></thead>
    <tbody>
      ${snapshot.photoEvidence
        .map(
          (photo) =>
            `<tr><td class="long-token">${escapeHtml(photo.id)}</td><td class="long-token">${escapeHtml(photo.timeEntryId ?? "")}</td><td>${escapeHtml(formatEvidenceType(photo.evidenceType))}</td><td>${escapeHtml(photo.caption ?? "")}</td><td>${escapeHtml(photo.capturedAt ? formatLocalDateTime(photo.capturedAt) : "")}</td></tr>`,
        )
        .join("")}
    </tbody>
  </table>
  ${buildPhotoEvidenceCards(snapshot)}

  <h2>GPS appendix</h2>
  ${buildGpsAppendix(snapshot)}

  <h2>Disclaimer</h2>
  <p>${escapeHtml(snapshot.disclaimer)}</p>
  <p class="muted">${escapeHtml(snapshot.localStorageNotice)}</p>
</body>
</html>`;
}

function buildPhotoEvidenceCards(snapshot: ProgressClaimSnapshot): string {
  if (snapshot.photoEvidence.length === 0) {
    return `<p class="muted">No photo evidence was recorded for this project report.</p>`;
  }

  return snapshot.photoEvidence
    .map((photo) => {
      const imageUri = photo.printUri ?? "";
      const canEmbedImage = imageUri.startsWith("data:image/");
      const imageMarkup = canEmbedImage
        ? `<img class="photo-thumb" src="${escapeHtml(imageUri)}" alt="Photo evidence ${escapeHtml(photo.id)}" />`
        : `<div class="photo-placeholder">Photo file reference only</div>`;
      return `<div class="photo-card"><div class="photo-card-header">Photo Evidence ID: ${escapeHtml(photo.id)}</div><div class="photo-card-body">${imageMarkup}<div>${detailsTable([
        ["Linked time entry", photo.timeEntryId],
        ["Type", formatEvidenceType(photo.evidenceType)],
        ["Caption", photo.caption],
        ["Captured at", photo.capturedAt ? formatLocalDateTime(photo.capturedAt) : "Time unknown"],
        ["Source", photo.captureSource ?? "Source not recorded (older record)"],
        ["Time source", photo.captureTimeSource ?? "unknown"],
        ["Seal hash (first 12 hex)", photo.lockHash?.slice(0, 12) ?? "Unavailable"],
        ["Photo storage", photoReferenceLabel(photo.localUri)],
      ])}</div></div></div>`;
    })
    .join("");
}

function photoReferenceLabel(uri: string): string {
  return uri.startsWith("data:image/") ? "Embedded image data" : "Sealed photo on this phone";
}

function formatEnteredRate(snapshot: ProgressClaimSnapshot): string {
  const { baseRateCents, currency, hourlyRateCents, rateBasis } = snapshot.rateCalculation;
  const enteredCents = Number.isFinite(baseRateCents) ? baseRateCents : hourlyRateCents;
  if (rateBasis === "daily") return `${formatMoney(enteredCents, currency)} per day → ${formatMoney(hourlyRateCents, currency)}/h`;
  return `${formatMoney(enteredCents, currency)} per ${rateBasis === "monthly" ? "month" : "hour"}`;
}

function formatDate(value: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatLocalDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const dateText = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Singapore" });
  const timeText = date.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short", timeZone: "Asia/Singapore" });
  return `${dateText}, ${timeText}`;
}

function detailsTable(rows: Array<[string, string | number | null | undefined]>): string {
  return `<table><colgroup><col style="width:35%"><col style="width:65%"></colgroup><tbody>${rows
    .map(
      ([label, value]) =>
        `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(String(value ?? ""))}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}

function dailyLogCard(item: ProgressClaimSnapshot["dailyWorkLog"][number], currency: string, hourlyRateCents: number): string {
  const values = [["Normal", formatHoursAndMinutes(item.normalMinutes)], ["OT", formatHoursAndMinutes(item.overtimeMinutes)], ["Off day", formatHoursAndMinutes(item.offDayMinutes)], ["Holiday", formatHoursAndMinutes(item.holidayMinutes)], ["Rate", formatMoney(hourlyRateCents, currency)], ["Basic pay", formatMoney(item.basicPayCents ?? 0, currency)], ["OT pay", formatMoney(item.overtimePayCents ?? 0, currency)], ["Off day pay", formatMoney(item.offDayPayCents ?? 0, currency)], ["Holiday pay", formatMoney(item.holidayPayCents ?? 0, currency)], ["Photos", item.photoEvidenceIds.length], ["Day total", formatMoney(item.grossPayCents ?? 0, currency)]];
  return `<section class="daily-log-card"><span class="daily-log-date short-cell">${escapeHtml(formatDate(item.workDate))} · ${escapeHtml(item.dayTypes.map(formatDayType).join(", "))} day</span><p class="daily-log-copy"><strong>Activity:</strong> ${escapeHtml(item.activity)}</p><p class="daily-log-copy"><strong>Location:</strong> ${escapeHtml(formatLocations(item.locations))}</p>${item.lunchDeductedMinutes ? `<p class="muted">Lunch deducted: ${formatLunch(item.lunchDeductedMinutes)}</p>` : ""}<div class="daily-log-grid">${values.map(([label, value]) => `<span><strong>${label}:</strong> ${value}</span>`).join("")}</div></section>`;
}

function dailyTotalsCard(snapshot: ProgressClaimSnapshot): string { const totals = snapshot.totals; return `<section class="daily-log-card"><span class="daily-log-date short-cell">Totals</span><div class="daily-log-grid"><span><strong>Normal:</strong> ${formatHoursAndMinutes(totals.totalNormalMinutes)}</span><span><strong>OT:</strong> ${formatHoursAndMinutes(totals.totalOvertimeMinutes)}</span><span><strong>Off day:</strong> ${formatHoursAndMinutes(totals.totalOffDayMinutes)}</span><span><strong>Holiday:</strong> ${formatHoursAndMinutes(totals.totalHolidayMinutes)}</span><span><strong>Basic pay:</strong> ${formatMoney(totals.basicPayCents, snapshot.rateCalculation.currency)}</span><span><strong>OT pay:</strong> ${formatMoney(totals.overtimePayCents, snapshot.rateCalculation.currency)}</span><span><strong>Off day pay:</strong> ${formatMoney(totals.offDayPayCents, snapshot.rateCalculation.currency)}</span><span><strong>Holiday pay:</strong> ${formatMoney(totals.holidayPayCents, snapshot.rateCalculation.currency)}</span><span><strong>Day total:</strong> ${formatMoney(totals.grossPayCents, snapshot.rateCalculation.currency)}</span></div></section>`; }
function formatHoursAndMinutes(minutes: number): string { const safeMinutes = Math.max(0, Math.round(minutes)); const hours = Math.floor(safeMinutes / 60); const remainder = safeMinutes % 60; return hours ? `${hours} h${remainder ? ` ${remainder} min` : ""}` : `${remainder} min`; }
function formatEvidenceType(value: string | null | undefined): string { const words = (value ?? "").split("_").filter(Boolean).map((word) => word.toLowerCase()); return words.map((word, index) => index === 0 ? word[0].toUpperCase() + word.slice(1) : word).join(" "); }
function formatLunch(minutes: number): string { return minutes === 60 ? "1 h" : minutes === 90 ? "1.5 h" : minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`; }
function lunchWindow(start: string, end: string, minutes: number): string { const parse = (value: string) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; }; const print = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; const middle = Math.floor((parse(start) + parse(end)) / 2); return `${print(middle - Math.floor(minutes / 2))}–${print(middle + Math.ceil(minutes / 2))}`; }

function formatMoney(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

function formatDayType(value: string): string {
  if (value === "off_day") {
    return "Off day";
  }
  if (value === "holiday") {
    return "Holiday";
  }
  return "Normal";
}

function buildWorkSites(snapshot: ProgressClaimSnapshot): string {
  const sites = new Map<string, Set<string>>();
  for (const day of snapshot.dailyWorkLog) {
    for (const location of day.locations) {
      const address = location.siteAddress ?? location.address.split(" · ")[0];
      if (!address || location.source === "none" || location.address.startsWith("Typed by worker, not GPS:")) continue;
      const dates = sites.get(address) ?? new Set<string>();
      dates.add(day.workDate);
      sites.set(address, dates);
    }
  }
  return `<table><colgroup><col style="width:52%"><col style="width:12%"><col style="width:18%"><col style="width:18%"></colgroup><thead><tr><th>Address</th><th>Days</th><th>First date</th><th>Last date</th></tr></thead><tbody>${[...sites].map(([address, dates]) => {
    const sorted = [...dates].sort();
    return `<tr><td>${escapeHtml(address)}</td><td class="short-cell">${dates.size}</td><td class="short-cell">${escapeHtml(formatDate(sorted[0]))}</td><td class="short-cell">${escapeHtml(formatDate(sorted[sorted.length - 1]))}</td></tr>`;
  }).join("")}</tbody></table>`;
}

function buildGpsAppendix(snapshot: ProgressClaimSnapshot): string {
  return snapshot.dailyWorkLog.flatMap((day) => {
    const fixes = day.locationEntries?.flatMap((entry) => {
      const initial = [
        { phase: "start", latitude: entry.clockInGpsLatitude, longitude: entry.clockInGpsLongitude, accuracy: entry.clockInGpsAccuracyM, source: entry.clockInLocationSource, locatedAt: entry.clockInLocatedAt },
        { phase: "stop", latitude: entry.clockOutGpsLatitude, longitude: entry.clockOutGpsLongitude, accuracy: entry.clockOutGpsAccuracyM, source: entry.clockOutLocationSource, locatedAt: entry.clockOutLocatedAt },
      ];
      const history = entry.locationHistoryJson ? JSON.parse(entry.locationHistoryJson) as import("../work/locationEvidence").LocationReading[] : [];
      // History includes initial patches too. Print each captured reading once per entry.
      const seen = new Set<string>();
      return [...initial, ...history].filter((fix) => {
        const key = JSON.stringify([fix.phase, fix.latitude, fix.longitude, fix.locatedAt ?? null, fix.accuracy ?? null, fix.source ?? "legacy"]);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }) ?? day.locations;
    return fixes.filter((fix) => fix.latitude != null && fix.longitude != null)
      .map((fix) => `<div class="gps-appendix">${escapeHtml(`${formatDate(day.workDate)} · ${fix.phase ?? "start/stop"} · ${formatCoordinates(fix.latitude ?? null, fix.longitude ?? null)} · ${fix.accuracy == null ? "accuracy unknown" : `±${Math.round(fix.accuracy)} m`} · ${fix.source ?? "legacy"}${fix.locatedAt ? ` · ${formatLocalDateTime(fix.locatedAt)}` : ""}`)}</div>`);
  }).join("");
}

function formatLocations(
  locations: Array<{ address: string; latitude: number | null; longitude: number | null }>,
): string {
  return locations.map((location) => location.address.replace(/ · \d{4}-\d{2}-\d{2}T[^; ]+/g, "")).join("; ");
}

function formatCoordinates(
  latitude: number | null,
  longitude: number | null,
): string {
  return latitude != null && longitude != null
    ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
    : "";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
