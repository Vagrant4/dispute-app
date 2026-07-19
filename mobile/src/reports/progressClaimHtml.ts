import type { ProgressClaimSnapshot } from "./progressClaimTypes";

export function buildProgressClaimHtml(snapshot: ProgressClaimSnapshot): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(snapshot.title)}</title>
  <style>
    body { color: #10201d; font-family: Arial, sans-serif; line-height: 1.4; margin: 32px; }
    h1 { color: #115e59; font-size: 28px; margin: 0 0 8px; }
    h2 { border-bottom: 1px solid #d5e2de; color: #10201d; font-size: 18px; margin-top: 28px; padding-bottom: 6px; }
    table { border-collapse: collapse; margin-top: 10px; width: 100%; }
    th, td { border: 1px solid #d5e2de; font-size: 12px; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #eef6f4; color: #10201d; }
    .muted { color: #5a6b67; font-size: 12px; }
    .summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .box { border: 1px solid #d5e2de; padding: 10px; }
    .location-grid { display: grid; gap: 10px; grid-template-columns: repeat(2, 1fr); margin-top: 10px; }
    .location-card { border: 1px solid #b9d8d2; border-radius: 12px; overflow: hidden; }
    .location-map { background: linear-gradient(135deg, #dff3ef 0%, #f6fbfa 45%, #cde9e4 100%); border-bottom: 1px solid #b9d8d2; min-height: 92px; position: relative; }
    .location-map::before { background: repeating-linear-gradient(90deg, rgba(17, 94, 89, 0.13) 0 1px, transparent 1px 28px), repeating-linear-gradient(0deg, rgba(17, 94, 89, 0.10) 0 1px, transparent 1px 24px); content: ""; inset: 0; position: absolute; }
    .location-pin { background: #dc2626; border: 3px solid #fff; border-radius: 999px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.22); height: 18px; left: 50%; position: absolute; top: 46%; transform: translate(-50%, -50%); width: 18px; }
    .location-pin::after { background: #dc2626; bottom: -8px; content: ""; height: 10px; left: 4px; position: absolute; transform: rotate(45deg); width: 10px; }
    .location-body { padding: 10px; }
    .photo-card { border: 1px solid #d5e2de; border-radius: 12px; margin-top: 10px; overflow: hidden; page-break-inside: avoid; }
    .photo-card-header { background: #eef6f4; font-size: 12px; font-weight: 700; padding: 8px 10px; }
    .photo-card-body { display: grid; gap: 10px; grid-template-columns: 150px 1fr; padding: 10px; }
    .photo-thumb { border: 1px solid #d5e2de; border-radius: 8px; max-height: 120px; max-width: 150px; object-fit: cover; }
    .photo-placeholder { align-items: center; background: #f6fbfa; border: 1px dashed #b9d8d2; border-radius: 8px; color: #5a6b67; display: flex; font-size: 11px; justify-content: center; min-height: 90px; padding: 8px; text-align: center; }
  </style>
</head>
<body>
  <h1>${escapeHtml(snapshot.title)}</h1>
  <p class="muted">Generated ${escapeHtml(snapshot.generatedAt)}</p>

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
    ["Description", snapshot.project.description],
    ["Currency", snapshot.project.currency],
  ])}

  <h2>Claim Period</h2>
  ${detailsTable([
    ["Start", snapshot.claimPeriod.start],
    ["End", snapshot.claimPeriod.end],
  ])}

  <h2>Rate Calculation</h2>
  ${detailsTable([
    ["Hourly rate", formatMoney(snapshot.rateCalculation.hourlyRateCents, snapshot.rateCalculation.currency)],
    ["Normal working time", `${snapshot.rateCalculation.normalWorkStartTime} - ${snapshot.rateCalculation.normalWorkEndTime}`],
    ["Normal hours from range", String(snapshot.rateCalculation.dailyNormalMinutes / 60)],
    ["Overtime multiplier", String(snapshot.rateCalculation.overtimeMultiplier)],
    ["Off day multiplier", String(snapshot.rateCalculation.offDayMultiplier)],
    ["Holiday multiplier", String(snapshot.rateCalculation.holidayMultiplier)],
    ["OT rule", `OT starts after ${snapshot.rateCalculation.normalWorkEndTime}`],
    ["Special day rule", "Off day and holiday entries apply their multiplier to all recorded hours."],
  ])}

  <h2>Pay Summary</h2>
  ${detailsTable([
    ["Days worked", String(snapshot.totals.totalDaysWorked)],
    ["Normal hours", String(snapshot.totals.totalNormalHours)],
    ["Overtime hours", String(snapshot.totals.totalOvertimeHours)],
    ["Off day hours", String(snapshot.totals.totalOffDayHours)],
    ["Holiday hours", String(snapshot.totals.totalHolidayHours)],
    ["Basic pay", formatMoney(snapshot.totals.basicPayCents, snapshot.rateCalculation.currency)],
    ["OT pay", formatMoney(snapshot.totals.overtimePayCents, snapshot.rateCalculation.currency)],
    ["Off day pay", formatMoney(snapshot.totals.offDayPayCents, snapshot.rateCalculation.currency)],
    ["Holiday pay", formatMoney(snapshot.totals.holidayPayCents, snapshot.rateCalculation.currency)],
    ["Allowances", formatMoney(snapshot.totals.allowancesCents, snapshot.rateCalculation.currency)],
    ["Gross pay", formatMoney(snapshot.totals.grossPayCents, snapshot.rateCalculation.currency)],
    ["Net pay", formatMoney(snapshot.totals.netPayCents, snapshot.rateCalculation.currency)],
    ["Total claim amount", formatMoney(snapshot.totals.totalClaimAmountCents, snapshot.rateCalculation.currency)],
  ])}

  <h2>Daily Work Log</h2>
  <table>
    <thead><tr><th>Date</th><th>Day type</th><th>Activity</th><th>Location</th><th>Normal hours</th><th>OT hours</th><th>Off day hours</th><th>Holiday hours</th><th>Photos</th></tr></thead>
    <tbody>
      ${snapshot.dailyWorkLog
        .map(
          (item) =>
            `<tr><td>${escapeHtml(item.workDate)}</td><td>${escapeHtml(item.dayTypes.map(formatDayType).join(", "))}</td><td>${escapeHtml(item.activity)}</td><td>${escapeHtml(formatLocations(item.locations))}</td><td>${item.normalHours}</td><td>${item.overtimeHours}</td><td>${item.offDayHours}</td><td>${item.holidayHours}</td><td>${escapeHtml(item.photoEvidenceIds.join(", "))}</td></tr>`,
        )
        .join("")}
    </tbody>
  </table>

  <h2>Location Graphic</h2>
  ${buildLocationGraphic(snapshot)}

  <h2>Photo Evidence</h2>
  <table>
    <thead><tr><th>Photo Evidence ID</th><th>Linked Time Entry ID</th><th>Type</th><th>Caption</th><th>Captured at</th><th>Local reference</th></tr></thead>
    <tbody>
      ${snapshot.photoEvidence
        .map(
          (photo) =>
            `<tr><td>${escapeHtml(photo.id)}</td><td>${escapeHtml(photo.timeEntryId ?? "")}</td><td>${escapeHtml(photo.evidenceType ?? "")}</td><td>${escapeHtml(photo.caption ?? "")}</td><td>${escapeHtml(photo.capturedAt ?? "")}</td><td>${escapeHtml(photo.localUri)}</td></tr>`,
        )
        .join("")}
    </tbody>
  </table>
  ${buildPhotoEvidenceCards(snapshot)}

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
      const imageUri = photo.printUri || photo.localUri;
      const canEmbedImage =
        imageUri.startsWith("file:") ||
        imageUri.startsWith("content:") ||
        imageUri.startsWith("data:image/");
      const imageMarkup = canEmbedImage
        ? `<img class="photo-thumb" src="${escapeHtml(imageUri)}" alt="Photo evidence ${escapeHtml(photo.id)}" />`
        : `<div class="photo-placeholder">Photo file reference only</div>`;
      return `<div class="photo-card"><div class="photo-card-header">Photo Evidence ID: ${escapeHtml(photo.id)}</div><div class="photo-card-body">${imageMarkup}<div>${detailsTable([
        ["Linked time entry", photo.timeEntryId],
        ["Type", photo.evidenceType],
        ["Caption", photo.caption],
        ["Captured at", photo.capturedAt],
        ["Local reference", photo.localUri],
      ])}</div></div></div>`;
    })
    .join("");
}

function detailsTable(rows: Array<[string, string | number | null | undefined]>): string {
  return `<table><tbody>${rows
    .map(
      ([label, value]) =>
        `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(String(value ?? ""))}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}

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

function buildLocationGraphic(snapshot: ProgressClaimSnapshot): string {
  const locationItems = snapshot.dailyWorkLog.flatMap((item) =>
    item.locations.map((location) => ({
      ...location,
      workDate: item.workDate,
    })),
  );

  if (locationItems.length === 0) {
    return `<p class="muted">No location address or coordinates were recorded for this report.</p>`;
  }

  return `<div class="location-grid">${locationItems
    .map(
      (location) =>
        `<div class="location-card"><div class="location-map"><span class="location-pin"></span></div><div class="location-body"><strong>${escapeHtml(location.workDate)}</strong><br />${escapeHtml(location.address)}<br /><span class="muted">${escapeHtml(formatCoordinates(location.latitude, location.longitude))}</span></div></div>`,
    )
    .join("")}</div>`;
}

function formatLocations(
  locations: Array<{ address: string; latitude: number | null; longitude: number | null }>,
): string {
  return locations
    .map((location) => {
      const coordinates = formatCoordinates(location.latitude, location.longitude);
      return coordinates ? `${location.address} (${coordinates})` : location.address;
    })
    .join("; ");
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
