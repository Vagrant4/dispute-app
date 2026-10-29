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
