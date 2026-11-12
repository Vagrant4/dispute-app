export type BreakInterval = { startedAt: string; endedAt: string | null };
export type TaskSwitch = { taskId: string | null; at: string };

export function closeOpenBreak(intervals: BreakInterval[], at: Date): BreakInterval[] {
  return intervals.map((item) => item.endedAt ? item : { ...item, endedAt: at.toISOString() });
}

export function summarizeBreaks(intervals: BreakInterval[], now = new Date()): { seconds: number; minutes: number } {
  const seconds = Math.round(intervals.reduce((sum, item) => {
    const start = new Date(item.startedAt).getTime();
    const end = item.endedAt ? new Date(item.endedAt).getTime() : now.getTime();
    return sum + Math.max(0, end - start);
  }, 0) / 1000);
  return { seconds, minutes: Math.round(seconds / 60) };
}

export function workedMinutes(start: string, end: string, breakMinutes: number): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000) - breakMinutes);
}

export function buildTaskSegments(params: { shiftStart: string; shiftEnd: string; switches: TaskSwitch[]; breaks: BreakInterval[] }) {
  const switches = [...params.switches]
    .filter((item) => new Date(item.at).getTime() < new Date(params.shiftEnd).getTime())
    .sort((a, b) => a.at.localeCompare(b.at));
  return switches.map((item, index) => {
    const start = Math.max(new Date(params.shiftStart).getTime(), new Date(item.at).getTime());
    const end = Math.min(new Date(params.shiftEnd).getTime(), index + 1 < switches.length ? new Date(switches[index + 1].at).getTime() : new Date(params.shiftEnd).getTime());
    const breakMs = params.breaks.reduce((sum, interval) => {
      const breakStart = new Date(interval.startedAt).getTime();
      const breakEnd = interval.endedAt ? new Date(interval.endedAt).getTime() : end;
      return sum + Math.max(0, Math.min(end, breakEnd) - Math.max(start, breakStart));
    }, 0);
    return { taskId: item.taskId, start: new Date(start).toISOString(), end: new Date(end).toISOString(), durationMinutes: Math.max(0, Math.round((end - start - breakMs) / 60_000)) };
  });
}
