export type TodayClockLayout = { size: number; frameSize: number; mapGap: number };

export function getTodayClockLayout(width: number, height: number): TodayClockLayout {
  const shortScreenLimit = height <= 700 ? 132 : height <= 860 ? 152 : 160;
  const widthLimit = Math.round(width * 0.42);
  const size = Math.max(132, Math.min(176, shortScreenLimit, widthLimit));
  return { size, frameSize: size + 20, mapGap: 24 };
}
