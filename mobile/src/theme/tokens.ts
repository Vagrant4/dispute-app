// Shared mobile typography, layout and control dimensions.
export const type = {
  title: { fontSize: 28, fontWeight: "700", lineHeight: 34 },
  heading: { fontSize: 20, fontWeight: "700", lineHeight: 26 },
  body: { fontSize: 16, fontWeight: "400", lineHeight: 24 },
  label: { fontSize: 16, fontWeight: "600", lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: "500", lineHeight: 18 },
} as const;
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;
export const control = { height: 52, radius: radius.md } as const;

// Today follows the approved clock and evidence-row mockup dimensions.
export const today = {
  title: { fontSize: 28, fontWeight: "700", lineHeight: 34 },
  wordmark: { fontSize: 13, fontWeight: "700", letterSpacing: 1.5 },
  status: { fontSize: 14, fontWeight: "600" },
  clock: { fontSize: 64, lineHeight: 78, fontWeight: "700", letterSpacing: -2 },
  period: { fontSize: 24, fontWeight: "600", letterSpacing: 0 },
  caption: { fontSize: 15, lineHeight: 22 },
  buttonText: { fontSize: 22, fontWeight: "700" },
  chevron: { fontSize: 28 },
  statusTop: 34, clockTop: 18, statusX: 14, statusY: 7,
  haloTop: 22, halo: 12, haloRadius: 100, buttonRadius: 88,
  rowOverlap: -1, rowGap: 14, rowY: 15, tileRadius: 12, subtitleGap: 5, subtitleTop: 3,
} as const;
