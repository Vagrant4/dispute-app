import { StyleSheet } from "react-native";

export const theme = {
  colors: {
    background: "#F7FAF9",
    surface: "#FFFFFF",
    surfaceMuted: "#EEF6F4",
    text: "#10201D",
    textMuted: "#5A6B67",
    border: "#D5E2DE",
    primary: "#0F766E",
    primaryDark: "#115E59",
    warningSurface: "#FFF7ED",
    warningBorder: "#FDBA74",
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32,
  },
};

export const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    paddingTop: theme.spacing.md,
  },
  appName: {
    color: theme.colors.primaryDark,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  screenTitle: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0,
    marginTop: 4,
  },
  tabScroller: {
    maxHeight: 52,
  },
  tabRow: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  tabButton: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    minWidth: 74,
    paddingHorizontal: theme.spacing.md,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tabButtonText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0,
  },
  tabButtonTextActive: {
    color: "#FFFFFF",
  },
  content: {
    flex: 1,
  },
  contentInner: {
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  warningCard: {
    backgroundColor: theme.colors.warningSurface,
    borderColor: theme.colors.warningBorder,
  },
  eyebrow: {
    color: theme.colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  heading: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0,
  },
  body: {
    color: theme.colors.text,
    fontSize: 16,
    lineHeight: 23,
  },
  muted: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  list: {
    gap: theme.spacing.sm,
  },
  row: {
    alignItems: "center",
    borderColor: theme.colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.sm,
  },
  rowLabel: {
    color: theme.colors.textMuted,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  rowValue: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
  },
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  statusPillText: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: "800",
  },
});
