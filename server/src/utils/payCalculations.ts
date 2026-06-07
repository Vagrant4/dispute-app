export function calculateBasicPay(hours: number, hourlyRate: number): number {
  assertNonNegative(hours, 'Hours');
  assertNonNegative(hourlyRate, 'Hourly rate');

  return roundMoney(hours * hourlyRate);
}

export function calculateOvertimePay(overtimeHours: number, overtimeRate: number): number {
  assertNonNegative(overtimeHours, 'Overtime hours');
  assertNonNegative(overtimeRate, 'Overtime rate');

  return roundMoney(overtimeHours * overtimeRate);
}

export function calculateGrossPay(
  basicPay: number,
  overtimePay: number,
  allowances: number,
  restDayPay: number,
  publicHolidayPay: number
): number {
  assertNonNegative(basicPay, 'Basic pay');
  assertNonNegative(overtimePay, 'Overtime pay');
  assertNonNegative(allowances, 'Allowances');
  assertNonNegative(restDayPay, 'Rest day pay');
  assertNonNegative(publicHolidayPay, 'Public holiday pay');

  return roundMoney(basicPay + overtimePay + allowances + restDayPay + publicHolidayPay);
}

export function calculateNetPay(grossPay: number, deductions: number): number {
  assertNonNegative(grossPay, 'Gross pay');
  assertNonNegative(deductions, 'Deductions');

  return roundMoney(grossPay - deductions);
}

function assertNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite`);
  }

  if (value < 0) {
    throw new Error(`${label} cannot be negative`);
  }
}

function roundMoney(value: number): number {
  const factor = 100;

  return Math.round((value + Number.EPSILON * Math.sign(value) * factor) * factor) / factor;
}
