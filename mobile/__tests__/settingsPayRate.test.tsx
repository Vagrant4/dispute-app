import fs from "node:fs";
import path from "node:path";

test("Settings edits a per-project pay rate and exposes stable Maestro ids", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/screens/SettingsScreen.tsx"), "utf8");
  expect(source).toMatch(/testID="settings-pay-rate-project-picker"/);
  expect(source).toMatch(/testID="settings-pay-rate-input"/);
  expect(source).toMatch(/testID="settings-pay-rate-save"/);
  expect(source).toMatch(/updateProject/);
});

test("PDF uses the selected project's rate and Settings period", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/screens/ProgressClaimReportsScreen.tsx"), "utf8");
  expect(source).toMatch(/hourlyRateCents: snapshot\.project\.hourlyRateCents/);
  expect(source).toMatch(/loadReportPeriod\(userId\)/);
});

