import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

jest.mock("../src/work/workLocation", () => ({ getWorkLocationWithTimeout: jest.fn().mockResolvedValue({ reason: "unavailable" }) }));
jest.mock("../src/subscription/useSubscriptionAccess", () => ({ useSubscriptionAccess: () => ({ canCreateRecords: true, hasCurrentCreateAccess: () => true, subscription: null, message: "" }) }));

const mockEntry = { id: "e1", projectId: "p1", projectName: "Site", clientName: "Client", workDate: "2026-11-10", startTime: "2026-11-10T00:00:00.000Z", endTime: null, breakMinutes: 0, durationMinutes: 0, activity: "", dayType: "normal", locationText: null, breakIntervals: [] as Array<{ startedAt: string; endedAt: string | null }>, taskSwitches: [], currentTaskId: null, clockInGpsLatitude: null, clockInGpsLongitude: null, clockOutGpsLatitude: null, clockOutGpsLongitude: null, status: "draft" };
const mockStore = {
  getHomeState: jest.fn(async () => ({ totalMinutesToday: 0, activeEntry: mockEntry, recentEntries: [] })),
  listProjects: jest.fn(async () => [{ id: "p1", clientId: "c1", name: "Site", clientName: "Client", description: null, hourlyRateCents: 0, currency: "SGD", status: "active" }]),
  listTasks: jest.fn(async () => [{ id: "t1", projectId: "p1", name: "Framing" }]),
  startBreak: jest.fn(async () => { mockEntry.breakIntervals = [{ startedAt: new Date().toISOString(), endedAt: null }]; }),
  endBreak: jest.fn(async () => { mockEntry.breakIntervals = mockEntry.breakIntervals.map((item) => ({ ...item, endedAt: new Date().toISOString() })); }),
  switchTask: jest.fn(async () => undefined),
  addTask: jest.fn(),
};
jest.mock("../src/db/repositories", () => ({ getLocalRepositories: async () => ({ work: mockStore }) }));
jest.mock("../src/work/webWorkStore", () => ({ webWorkStore: mockStore }));

import { HomeScreen } from "../src/screens/HomeScreen";

describe("0.3.15 Today break and task controls", () => {
  beforeEach(() => { mockEntry.breakIntervals = []; mockStore.startBreak.mockClear(); mockStore.endBreak.mockClear(); mockStore.switchTask.mockClear(); });

  it("starts and ends a break and updates the timer card", async () => {
    render(<HomeScreen account={{ id: "u1", email: "worker@example.com" } as never} />);
    fireEvent.press(await screen.findByText("Break"));
    await waitFor(() => expect(mockStore.startBreak).toHaveBeenCalled());
    expect(await screen.findByText("End break")).toBeTruthy();
    expect(screen.getByText(/On break/)).toBeTruthy();
    fireEvent.press(screen.getByText("End break"));
    await waitFor(() => expect(mockStore.endBreak).toHaveBeenCalled());
  });

  it("shows Switch task while running with tasks and calls switchTask", async () => {
    render(<HomeScreen account={{ id: "u1", email: "worker@example.com" } as never} />);
    fireEvent.press(await screen.findByText("Switch task"));
    fireEvent.press(await screen.findByText("Framing"));
    await waitFor(() => expect(mockStore.switchTask).toHaveBeenCalledWith({ userId: "u1", entryId: "e1", taskId: "t1" }));
  });
});
