import fs from "node:fs";
import path from "node:path";
import React from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react-native";

const mockSaveReportPeriod = jest.fn();
let mockStoredReportPeriod: "week" | "month" = "week";
const mockLoadReportPeriod = jest.fn(async () => mockStoredReportPeriod);
const mockSaveWorkHours = jest.fn();
const defaultMockSettings = {
  currency: "SGD", rateBasis: "hourly" as const, baseRateCents: 0,
  normalWorkStartTime: "09:00", normalWorkEndTime: "18:00", dailyHours: 8, weeklyHours: 44,
  overtimeMultiplier: 1.5, offDayMultiplier: 1.5, holidayMultiplier: 2, lunchMinutes: 0,
};
let mockSettings = { ...defaultMockSettings };
let mockLoadWorkHours: () => Promise<{ settings: typeof mockSettings }> = async () => ({ settings: mockSettings });
jest.mock("../src/work/workHoursSettings", () => ({
  calculateNormalHours: () => 8,
  loadWorkHours: () => mockLoadWorkHours(),
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

beforeEach(() => {
  mockStoredReportPeriod = "week";
  mockSettings = { ...defaultMockSettings };
  mockLoadWorkHours = async () => ({ settings: mockSettings });
  mockSaveWorkHours.mockReset();
  mockSaveReportPeriod.mockReset();
  mockLoadReportPeriod.mockReset();
  mockLoadReportPeriod.mockImplementation(async () => mockStoredReportPeriod);
});

afterEach(cleanup);

test("Settings edits only the user's pay rate and exposes stable ids", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/screens/SettingsScreen.tsx"), "utf8");
  expect(source).toMatch(/testID="pay-rate-own-rate"/);
  expect(source).not.toMatch(/ProjectPickerSheet|rateProjectId|handleSaveProjectRate|Project hourly rate/);
  expect(source).not.toMatch(/setTimeout\(\(\) => void handleSaveWorkHours\(\), 600\)/);
  expect(source).not.toMatch(/onBlur=\{\(\) => void handleSaveWorkHours\(\)\}/);
  expect(source).toMatch(/testID="settings-pay-rate-save"/);
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

  await waitFor(() => expect(screen.getByLabelText("Normal work start time").props.value).toBe("09:00"));
  expect(screen.queryByTestId("settings-pay-rate-project-picker")).toBeNull();
});

test("Paid by opens Daily, Monthly and Hourly options", async () => {
  const screen = render(
    <SettingsScreen
      account={{ id: "u1", email: "shi@example.com" } as never}
      initialPanel="work_hours"
      onAccountDeleted={jest.fn()}
      onLogout={jest.fn()}
    />,
  );

  await waitFor(() => expect(screen.getByLabelText("Rate entry type dropdown")).toBeTruthy());
  fireEvent.press(screen.getByLabelText("Rate entry type dropdown"));
  for (const option of ["Daily", "Monthly", "Hourly"]) {
    expect(screen.getByLabelText(`Rate entry ${option}`)).toBeTruthy();
  }
});

test("a report period load failure does not hide the pay rate", async () => {
  mockLoadReportPeriod.mockRejectedValueOnce(new Error("SecureStore unavailable"));
  const screen = render(
    <SettingsScreen account={{ id: "u1", email: "shi@example.com" } as never} initialPanel="work_hours" onAccountDeleted={jest.fn()} onLogout={jest.fn()} />,
  );
  await waitFor(() => expect(screen.getByLabelText("Normal work start time").props.value).toBe("09:00"));
  await waitFor(() => expect(screen.getByText("Couldn't load report period. Try again.")).toBeTruthy());
});

test("report period saves only when Save is pressed and persists across a remount", async () => {
  const screen = render(
    <SettingsScreen account={{ id: "u1", email: "shi@example.com" } as never} initialPanel="work_hours" onAccountDeleted={jest.fn()} onLogout={jest.fn()} />,
  );
  await waitFor(() => expect(screen.getByLabelText("Normal work start time").props.value).toBe("09:00"));
  expect(screen.getByText("This week")).toBeTruthy();
  fireEvent.press(screen.getByTestId("settings-report-period"));
  expect(screen.getByTestId("settings-report-period-sheet")).toBeTruthy();
  expect(screen.getByText("This month")).toBeTruthy();
  fireEvent.press(screen.getByTestId("settings-report-period-month"));
  expect(screen.queryByTestId("settings-report-period-sheet")).toBeNull();
  expect(mockSaveReportPeriod).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Save" }).props.accessibilityState.disabled).toBe(false);
  fireEvent.press(screen.getByTestId("settings-pay-rate-save"));
  await waitFor(() => expect(mockSaveReportPeriod).toHaveBeenCalledWith("u1", "month"));
  await waitFor(() => expect(screen.getByText("Saved")).toBeTruthy());
  screen.unmount();

  const remounted = render(
    <SettingsScreen account={{ id: "u1", email: "shi@example.com" } as never} initialPanel="work_hours" onAccountDeleted={jest.fn()} onLogout={jest.fn()} />,
  );
  await waitFor(() => expect(remounted.getByText("This month")).toBeTruthy());
});

test("own rate saves only when Save is pressed and persists across a remount", async () => {
  const screen = render(
    <SettingsScreen account={{ id: "u1", email: "shi@example.com" } as never} initialPanel="work_hours" onAccountDeleted={jest.fn()} onLogout={jest.fn()} />,
  );
  await waitFor(() => expect(screen.getByLabelText("Normal work start time").props.value).toBe("09:00"));
  fireEvent.changeText(screen.getByTestId("pay-rate-own-rate"), "150");
  fireEvent(screen.getByTestId("pay-rate-own-rate"), "blur");
  expect(mockSaveWorkHours).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Save" }).props.accessibilityState.disabled).toBe(false);
  fireEvent.press(screen.getByTestId("settings-pay-rate-save"));
  await waitFor(() => expect(mockSaveWorkHours).toHaveBeenCalledWith("u1", expect.objectContaining({ baseRateCents: 15_000, rateBasis: "hourly" })));
  await waitFor(() => expect(screen.getByText("Saved")).toBeTruthy());
  screen.unmount();
  const remounted = render(<SettingsScreen account={{ id: "u1", email: "shi@example.com" } as never} initialPanel="work_hours" onAccountDeleted={jest.fn()} onLogout={jest.fn()} />);
  await waitFor(() => expect(remounted.getByTestId("pay-rate-own-rate").props.value).toBe("150"));
});

test("dirty leave offers Discard or Save before returning to Settings", async () => {
  const screen = render(
    <SettingsScreen account={{ id: "u1", email: "shi@example.com" } as never} initialPanel="work_hours" onAccountDeleted={jest.fn()} onLogout={jest.fn()} />,
  );
  await waitFor(() => expect(screen.getByLabelText("Normal work start time").props.value).toBe("09:00"));

  fireEvent.changeText(screen.getByTestId("pay-rate-own-rate"), "150");
  fireEvent.press(screen.getByText("‹ Settings"));
  expect(screen.getByTestId("settings-pay-rate-leave-sheet")).toBeTruthy();
  fireEvent.press(screen.getByText("Discard"));
  await waitFor(() => expect(screen.getByText("Settings")).toBeTruthy());
  expect(mockSaveWorkHours).not.toHaveBeenCalled();

  fireEvent.press(screen.getByText("Pay rate"));
  await waitFor(() => expect(screen.getByTestId("pay-rate-own-rate")).toBeTruthy());
  fireEvent.changeText(screen.getByTestId("pay-rate-own-rate"), "175");
  fireEvent.press(screen.getByText("‹ Settings"));
  expect(screen.getByTestId("settings-pay-rate-leave-sheet")).toBeTruthy();
  fireEvent.press(screen.getAllByText("Save").at(-1)!);
  await waitFor(() => expect(mockSaveWorkHours).toHaveBeenCalledWith("u1", expect.objectContaining({ baseRateCents: 17_500 })));
  await waitFor(() => expect(screen.getByText("Settings")).toBeTruthy());
});

test("blur before load does not overwrite stored settings", async () => {
  mockSettings = {
    ...defaultMockSettings,
    rateBasis: "monthly",
    baseRateCents: 4_200_00,
    normalWorkStartTime: "07:30",
    normalWorkEndTime: "16:30",
    offDayMultiplier: 2.5,
  };
  let resolveLoad: ((value: { settings: typeof mockSettings }) => void) | undefined;
  mockLoadWorkHours = () => new Promise((resolve) => { resolveLoad = resolve; });
  const screen = render(
    <SettingsScreen account={{ id: "u1", email: "shi@example.com" } as never} initialPanel="work_hours" onAccountDeleted={jest.fn()} onLogout={jest.fn()} />,
  );

  fireEvent.changeText(screen.getByTestId("pay-rate-own-rate"), "150");
  fireEvent(screen.getByTestId("pay-rate-own-rate"), "blur");
  expect(mockSaveWorkHours).not.toHaveBeenCalled();

  await waitFor(() => expect(resolveLoad).toBeDefined());
  await act(async () => { resolveLoad?.({ settings: mockSettings }); });
  await waitFor(() => expect(screen.getByTestId("pay-rate-own-rate").props.value).toBe("4200"));
  expect(mockSaveWorkHours).not.toHaveBeenCalled();
  expect(mockSettings).toEqual(expect.objectContaining({
    rateBasis: "monthly",
    normalWorkStartTime: "07:30",
    normalWorkEndTime: "16:30",
    offDayMultiplier: 2.5,
  }));
});

