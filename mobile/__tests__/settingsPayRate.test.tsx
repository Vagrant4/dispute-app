import fs from "node:fs";
import path from "node:path";
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockSaveReportPeriod = jest.fn();
let mockStoredReportPeriod: "week" | "month" = "week";
const mockLoadReportPeriod = jest.fn(async () => mockStoredReportPeriod);
const mockSaveWorkHours = jest.fn();
let mockSettings = {
  currency: "SGD", rateBasis: "hourly" as const, baseRateCents: 0,
  normalWorkStartTime: "09:00", normalWorkEndTime: "18:00", dailyHours: 8, weeklyHours: 44,
  overtimeMultiplier: 1.5, offDayMultiplier: 1.5, holidayMultiplier: 2,
};
jest.mock("../src/work/workHoursSettings", () => ({
  calculateNormalHours: () => 8,
  loadWorkHours: async () => ({ settings: mockSettings }),
  saveWorkHours: (...args: unknown[]) => { mockSettings = args[1] as typeof mockSettings; mockSaveWorkHours(...args); return Promise.resolve(mockSettings); },
}));
jest.mock("../src/reports/reportPeriodSettings", () => ({
  loadReportPeriod: () => mockLoadReportPeriod(),
  saveReportPeriod: (...args: [string, "week" | "month"]) => {
    mockStoredReportPeriod = args[1];
    mockSaveReportPeriod(...args);
    return Promise.resolve();
  },
}));
jest.mock("../src/subscription/useSubscriptionAccess", () => ({
  useSubscriptionAccess: () => ({
    subscription: null,
    canCreateRecords: true,
    refresh: jest.fn(),
  }),
}));
jest.mock("../src/subscription/useDisputeBasicStorePrice", () => ({
  useDisputeBasicStorePrice: () => null,
}));
jest.mock("../src/screens/DeleteAccountScreen", () => ({ DeleteAccountScreen: () => null }));
jest.mock("../src/screens/PlanBillingPanel", () => ({ PlanBillingPanel: () => null }));
jest.mock("../src/screens/PrivacyScreen", () => ({ PrivacyScreen: () => null }));
jest.mock("../src/screens/ProfileSettingsPanel", () => ({ ProfileSettingsPanel: () => null }));
jest.mock("../src/screens/SettingsBackupScreen", () => ({ SettingsBackupScreen: () => null }));
jest.mock("../src/subscription/subscriptionClient", () => ({
  planTrialLine: () => null,
  getSubscriptionManagementUrl: () => null,
  getSubscriptionSettingsAction: () => "subscribe",
  purchaseDisputeBasicSubscription: jest.fn(),
}));
jest.mock("../src/subscription/recordAccess", () => ({
  getDisputePackBillingNote: () => "",
}));

import { SettingsScreen } from "../src/screens/SettingsScreen";

test("Settings edits only the user's pay rate and exposes stable ids", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/screens/SettingsScreen.tsx"), "utf8");
  expect(source).toMatch(/testID="pay-rate-own-rate"/);
  expect(source).not.toMatch(/ProjectPickerSheet|rateProjectId|handleSaveProjectRate|Project hourly rate/);
  expect(source).toMatch(/setTimeout\([\s\S]*?, 600\)/);
  expect(source).toMatch(/onBlur=/);
  expect(source).not.toMatch(/updateProject/);
});

test("PDF uses the user's rate and Settings period", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/screens/ProgressClaimReportsScreen.tsx"), "utf8");
  expect(source).toMatch(/hourlyRateCents: ownRateToHourlyCents\(preferences\.settings\)/);
  expect(source).toMatch(/loadReportPeriod\(userId\)/);
});

test("pay rate shows the user's current rate", async () => {
  const screen = render(
    <SettingsScreen
      account={{ id: "u1", email: "shi@example.com" } as never}
      initialPanel="work_hours"
      onAccountDeleted={jest.fn()}
      onLogout={jest.fn()}
    />,
  );

  await waitFor(() => expect(screen.getByTestId("pay-rate-own-rate")).toBeTruthy());
  expect(screen.queryByTestId("settings-pay-rate-project-picker")).toBeNull();
});

test("a report period load failure does not hide the pay rate", async () => {
  mockLoadReportPeriod.mockRejectedValueOnce(new Error("SecureStore unavailable"));
  const screen = render(
    <SettingsScreen account={{ id: "u1", email: "shi@example.com" } as never} initialPanel="work_hours" onAccountDeleted={jest.fn()} onLogout={jest.fn()} />,
  );
  await waitFor(() => expect(screen.getByTestId("pay-rate-own-rate")).toBeTruthy());
  expect(screen.getByText("Couldn't load report period. Try again.")).toBeTruthy();
});

test("report period saves immediately and persists across a remount", async () => {
  mockStoredReportPeriod = "week";
  mockSaveReportPeriod.mockReset();
  const screen = render(
    <SettingsScreen account={{ id: "u1", email: "shi@example.com" } as never} initialPanel="work_hours" onAccountDeleted={jest.fn()} onLogout={jest.fn()} />,
  );
  await waitFor(() => expect(screen.getByText("This week")).toBeTruthy());
  fireEvent.press(screen.getByTestId("settings-report-period"));
  expect(screen.getByTestId("settings-report-period-sheet")).toBeTruthy();
  expect(screen.getByText("This month")).toBeTruthy();
  fireEvent.press(screen.getByTestId("settings-report-period-month"));
  expect(screen.queryByTestId("settings-report-period-sheet")).toBeNull();
  await waitFor(() => expect(mockSaveReportPeriod).toHaveBeenCalledWith("u1", "month"));
  expect(screen.getByText("Saved")).toBeTruthy();
  screen.unmount();

  const remounted = render(
    <SettingsScreen account={{ id: "u1", email: "shi@example.com" } as never} initialPanel="work_hours" onAccountDeleted={jest.fn()} onLogout={jest.fn()} />,
  );
  await waitFor(() => expect(remounted.getByText("This month")).toBeTruthy());
});

test("own rate blur saves and persists across a remount", async () => {
  mockSettings = { ...mockSettings, baseRateCents: 0, rateBasis: "hourly" };
  mockSaveWorkHours.mockClear();
  const screen = render(
    <SettingsScreen account={{ id: "u1", email: "shi@example.com" } as never} initialPanel="work_hours" onAccountDeleted={jest.fn()} onLogout={jest.fn()} />,
  );
  await waitFor(() => expect(screen.getByTestId("pay-rate-own-rate")).toBeTruthy());
  fireEvent.changeText(screen.getByTestId("pay-rate-own-rate"), "150");
  fireEvent(screen.getByTestId("pay-rate-own-rate"), "blur");
  await waitFor(() => expect(mockSaveWorkHours).toHaveBeenCalledWith("u1", expect.objectContaining({ baseRateCents: 15_000, rateBasis: "hourly" })));
  screen.unmount();
  const remounted = render(<SettingsScreen account={{ id: "u1", email: "shi@example.com" } as never} initialPanel="work_hours" onAccountDeleted={jest.fn()} onLogout={jest.fn()} />);
  await waitFor(() => expect(remounted.getByTestId("pay-rate-own-rate").props.value).toBe("150"));
});

