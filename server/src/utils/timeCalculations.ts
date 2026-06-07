export function calculateTotalHours(clockIn: Date, clockOut: Date, breakMinutes: number): number {
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
  if (totalHours < 0) {
    throw new Error('Total hours cannot be negative');
  }

  if (standardDailyHours <= 0) {
    throw new Error('Standard daily hours must be positive');
  }

  return roundHours(Math.max(0, totalHours - standardDailyHours));
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}
