import fs from "node:fs";
import path from "node:path";
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const storedProject = {
  id: "project-1111",
  userId: "u1",
  name: "1111.",
  description: "Existing project",
  hourlyRateCents: 0,
};
const mockListProjects = jest.fn();
const mockUpdateProject = jest.fn();
const mockGetProjectScreenStore = jest.fn(async () => ({
  listProjects: mockListProjects,
  updateProject: mockUpdateProject,
}));
const mockSaveReportPeriod = jest.fn();

jest.mock("../src/work/projectScreenStore", () => ({
  getProjectScreenStore: (...args: unknown[]) => mockGetProjectScreenStore(...args),
}));
jest.mock("../src/work/workHoursSettings", () => ({
  calculateNormalHours: () => 8,
  loadWorkHours: async () => ({
    settings: {
      currency: "SGD",
      rateBasis: "hourly",
      baseRateCents: 0,
      normalWorkStartTime: "09:00",
      normalWorkEndTime: "18:00",
      dailyHours: 8,
      weeklyHours: 44,
      overtimeMultiplier: 1.5,
      offDayMultiplier: 1.5,
      holidayMultiplier: 2,
    },
  }),
  saveWorkHours: jest.fn(),
}));
jest.mock("../src/reports/reportPeriodSettings", () => ({
  loadReportPeriod: async () => "week",
  saveReportPeriod: (...args: unknown[]) => mockSaveReportPeriod(...args),
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

test("first Save resolves an existing stored project and upserts a missing rate", async () => {
  mockGetProjectScreenStore.mockClear();
  mockListProjects.mockReset();
  mockUpdateProject.mockReset();
  mockSaveReportPeriod.mockReset();
  mockListProjects
    .mockRejectedValueOnce(new Error("transient project load failure"))
    .mockResolvedValueOnce([storedProject]);

  const screen = render(
    <SettingsScreen
      account={{ id: "u1", email: "shi@example.com" } as never}
      initialPanel="work_hours"
      onAccountDeleted={jest.fn()}
      onLogout={jest.fn()}
    />,
  );

  await waitFor(() => expect(mockListProjects).toHaveBeenCalledTimes(1));
  expect(screen.getByText("No project")).toBeTruthy();
  expect(screen.getByText("Couldn't load pay rate. Reopen the app and try again.")).toBeTruthy();
  fireEvent.changeText(screen.getByTestId("settings-pay-rate-input"), "150");
  fireEvent.press(screen.getByTestId("settings-pay-rate-save"));

  await waitFor(() => expect(screen.getByText("Saved")).toBeTruthy());
  expect(mockUpdateProject).toHaveBeenCalledWith(expect.objectContaining({
    userId: "u1",
    projectId: storedProject.id,
    hourlyRateCents: 15_000,
  }));
  expect(screen.queryByText("Couldn't load pay rate. Reopen the app and try again.")).toBeNull();
});

