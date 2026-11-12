import type { WorkDayType } from "./workRepository";

// update yearly — MOM public holidays, including substitute Mondays (Sunday rest day).
// https://www.mom.gov.sg/employment-practices/public-holidays
const HOLIDAYS = new Set([
  "2026-01-01", "2026-02-17", "2026-02-18", "2026-03-21", "2026-04-03",
  "2026-05-01", "2026-05-27", "2026-05-31", "2026-06-01", "2026-08-09",
  "2026-08-10", "2026-11-08", "2026-11-09", "2026-12-25",
  "2027-01-01", "2027-02-06", "2027-02-07", "2027-02-08", "2027-03-10",
  "2027-03-26", "2027-05-01", "2027-05-17", "2027-05-20", "2027-08-09",
  "2027-10-28", "2027-12-25",
]);

export function defaultDayType(date: Date): WorkDayType {
  const singapore = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  // Sunday takes precedence; workers may adjust the suggested type before starting.
  if (singapore.getUTCDay() === 0) return "off_day";
  return HOLIDAYS.has(singapore.toISOString().slice(0, 10)) ? "holiday" : "normal";
}
