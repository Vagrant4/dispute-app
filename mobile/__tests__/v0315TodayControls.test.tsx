import React from "react";
import fs from "node:fs";
import path from "node:path";
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

import { TodayRunningControls } from "../src/screens/HomeScreen";

describe("0.3.15 Today break and task controls", () => {
  it("starts and ends a break and updates the timer card", async () => {
    const onBreakPress = jest.fn();
    const view = render(<TodayRunningControls onBreak={false} onBreakPress={onBreakPress} tasks={[]} onSwitchTask={jest.fn()} />);
    fireEvent.press(screen.getByText("Break"));
    expect(onBreakPress).toHaveBeenCalled();
    view.rerender(<TodayRunningControls onBreak onBreakPress={onBreakPress} tasks={[]} onSwitchTask={jest.fn()} />);
    expect(screen.getByText("End break")).toBeTruthy();
  });

  it("shows Switch task while running with tasks and calls switchTask", async () => {
    const onSwitchTask = jest.fn();
    render(<TodayRunningControls onBreak={false} onBreakPress={jest.fn()} tasks={[{ id: "t1", projectId: "p1", name: "Framing" }]} onSwitchTask={onSwitchTask} />);
    fireEvent.press(screen.getByText("Switch task"));
    fireEvent.press(await screen.findByText("Framing"));
    expect(onSwitchTask).toHaveBeenCalledWith("t1");
  });

  it("keeps the Today task row and picker with add-task support", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "../src/screens/HomeScreen.tsx"), "utf8");
    expect(source).toContain('<Text style={styles.todayProjectLabel}>Task</Text>');
    expect(source).toContain('accessibilityLabel="Choose task"');
    expect(source).toContain('<TaskPickerSheet tasks={tasks} selectedId={selectedTaskId}');
    expect(source).toContain('onAdd={handleAddTask}');
  });
});
