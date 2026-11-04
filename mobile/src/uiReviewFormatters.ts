export function formatTrialDaysLeft(endIso: string, nowMs: number, trialDays = 30): number {
  const remaining = Math.max(0, Math.ceil((Date.parse(endIso) - nowMs) / 86_400_000));
  return Math.min(trialDays, remaining);
}

export function formatWeekRange(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startMonth = start.toLocaleDateString("en-SG", { month: "short", timeZone: "UTC" });
  const endMonth = end.toLocaleDateString("en-SG", { month: "short", timeZone: "UTC" });
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  if (startMonth === endMonth && startYear === endYear) return `Week of ${startDay} – ${endDay} ${endMonth} ${endYear}`;
  if (startYear === endYear) return `Week of ${startDay} ${startMonth} – ${endDay} ${endMonth} ${endYear}`;
  return `Week of ${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
}

export function formatPhoneForDisplay(phone: string): string {
  const compact = phone.replace(/[\s-]/g, "");
  return /^\+65\d{8}$/.test(compact) ? `${compact.slice(0, 3)} ${compact.slice(3, 7)} ${compact.slice(7)}` : phone;
}
