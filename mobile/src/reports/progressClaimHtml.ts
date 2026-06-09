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
    .signature { height: 64px; }
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
    ["Daily normal hours", String(snapshot.rateCalculation.dailyNormalMinutes / 60)],
    ["Overtime multiplier", String(snapshot.rateCalculation.overtimeMultiplier)],
  ])}

  <h2>Pay Summary</h2>
  ${detailsTable([
    ["Days worked", String(snapshot.totals.totalDaysWorked)],
    ["Normal hours", String(snapshot.totals.totalNormalHours)],
    ["Overtime hours", String(snapshot.totals.totalOvertimeHours)],
    ["Basic pay", formatMoney(snapshot.totals.basicPayCents, snapshot.rateCalculation.currency)],
    ["OT pay", formatMoney(snapshot.totals.overtimePayCents, snapshot.rateCalculation.currency)],
    ["Allowances", formatMoney(snapshot.totals.allowancesCents, snapshot.rateCalculation.currency)],
    ["Deductions", formatMoney(snapshot.totals.deductionsCents, snapshot.rateCalculation.currency)],
    ["Gross pay", formatMoney(snapshot.totals.grossPayCents, snapshot.rateCalculation.currency)],
    ["Net pay", formatMoney(snapshot.totals.netPayCents, snapshot.rateCalculation.currency)],
    ["Total claim amount", formatMoney(snapshot.totals.totalClaimAmountCents, snapshot.rateCalculation.currency)],
  ])}

  <h2>Daily Work Log</h2>
  <table>
    <thead><tr><th>Date</th><th>Activity</th><th>Normal hours</th><th>OT hours</th><th>Photos</th></tr></thead>
    <tbody>
      ${snapshot.dailyWorkLog
        .map(
          (item) =>
            `<tr><td>${escapeHtml(item.workDate)}</td><td>${escapeHtml(item.activity)}</td><td>${item.normalHours}</td><td>${item.overtimeHours}</td><td>${escapeHtml(item.photoEvidenceIds.join(", "))}</td></tr>`,
        )
        .join("")}
    </tbody>
  </table>

  <h2>Photo Evidence</h2>
  <table>
    <thead><tr><th>ID</th><th>Type</th><th>Caption</th><th>Captured at</th><th>Local reference</th></tr></thead>
    <tbody>
      ${snapshot.photoEvidence
        .map(
          (photo) =>
            `<tr><td>${escapeHtml(photo.id)}</td><td>${escapeHtml(photo.evidenceType ?? "")}</td><td>${escapeHtml(photo.caption ?? "")}</td><td>${escapeHtml(photo.capturedAt ?? "")}</td><td>${escapeHtml(photo.localUri)}</td></tr>`,
        )
        .join("")}
    </tbody>
  </table>

  <h2>Signature</h2>
  <table>
    <tbody>
      <tr><th>Worker Signature</th><td class="signature">${escapeHtml(snapshot.signature.workerSignature)}</td></tr>
      <tr><th>Client Acknowledgement</th><td class="signature">${escapeHtml(snapshot.signature.clientAcknowledgement)}</td></tr>
      <tr><th>Signed At</th><td>${escapeHtml(snapshot.signature.signedAt)}</td></tr>
    </tbody>
  </table>

  <h2>Disclaimer</h2>
  <p>${escapeHtml(snapshot.disclaimer)}</p>
  <p class="muted">${escapeHtml(snapshot.localStorageNotice)}</p>
</body>
</html>`;
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
