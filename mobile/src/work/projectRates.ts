export const PROJECT_HOURLY_RATE_ERROR =
  "Enter a project hourly rate above SGD 0.00.";
export const PROJECT_HOURLY_RATE_FORMAT_ERROR =
  "Enter the project hourly rate in SGD using numbers only, with up to 2 decimal places.";
export const PROJECT_HOURLY_RATE_MAX_ERROR =
  "Enter a project hourly rate at or below SGD 1,000,000.00.";
export const PAY_REPORT_HOURLY_RATE_ERROR =
  "Set a project hourly rate above SGD 0.00 before creating a pay report.";
export const PAY_REPORT_PROJECT_REQUIRED_ERROR =
  "Create a project with an hourly rate before creating a pay report.";

const MAX_PROJECT_HOURLY_RATE_CENTS = 100_000_000;
const SGD_RATE_PATTERN = /^\d+(?:\.\d{1,2})?$/;

export function parseSgdHourlyRateCents(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(PROJECT_HOURLY_RATE_ERROR);
  }
  if (!SGD_RATE_PATTERN.test(trimmed)) {
    throw new Error(PROJECT_HOURLY_RATE_FORMAT_ERROR);
  }

  const [dollarsText, centsText = ""] = trimmed.split(".");
  const dollars = Number.parseInt(dollarsText, 10);
  const cents = Number.parseInt(centsText.padEnd(2, "0") || "0", 10);
  return requirePositiveProjectHourlyRateCents((dollars * 100) + cents);
}

export function requirePositiveProjectHourlyRateCents(
  value: number | null | undefined,
  message = PROJECT_HOURLY_RATE_ERROR,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(message);
  }

  const cents = Math.floor(value);
  if (cents <= 0) {
    throw new Error(message);
  }
  if (cents > MAX_PROJECT_HOURLY_RATE_CENTS) {
    throw new Error(PROJECT_HOURLY_RATE_MAX_ERROR);
  }
  return cents;
}

export function formatSgdHourlyRate(cents: number): string {
  return (cents / 100).toFixed(2);
}
