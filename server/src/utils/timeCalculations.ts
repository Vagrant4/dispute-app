export function calculateTotalHours(clockIn: Date, clockOut: Date, breakMinutes: number): number {
  assertValidDate(clockIn, 'Clock-in');
  assertValidDate(clockOut, 'Clock-out');
  assertFiniteNumber(breakMinutes, 'Break minutes');

  if (clockOut <= clockIn) {
    throw new Error('Clock-out must be after clock-in');
  }

  if (breakMinutes < 0) {
    throw new Error('Break minutes cannot be negative');
  }

  const durationMinutes = (clockOut.getTime() - clockIn.getTime()) / 60000;

  if (breakMinutes > durationMinutes) {
    throw new Error('Break minutes cannot exceed on-site duration');
  }

  return roundHours((durationMinutes - breakMinutes) / 60);
}

export function calculateOvertimeHours(totalHours: number, standardDailyHours: number): number {
  assertFiniteNumber(totalHours, 'Total hours');
  assertFiniteNumber(standardDailyHours, 'Standard daily hours');

  if (totalHours < 0) {
    throw new Error('Total hours cannot be negative');
  }

  if (standardDailyHours <= 0) {
    throw new Error('Standard daily hours must be positive');
  }

  return roundHours(Math.max(0, totalHours - standardDailyHours));
}

function assertValidDate(value: Date, label: string): void {
  if (!Number.isFinite(value.getTime())) {
    throw new Error(`${label} must be a valid date`);
  }
}

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite`);
  }
}

function roundHours(value: number): number {
  const factor = 100;

  return Math.round((value + Number.EPSILON * Math.sign(value) * factor) * factor) / factor;
}
