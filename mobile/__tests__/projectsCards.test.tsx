import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { ProjectsScreen } from "../src/screens/ProjectsScreen";

let summaries = [
  { id: "active-1", name: "Marina fitout", status: "active", projectStatus: "active", siteAddress: "10 Bayfront Avenue", siteLatitude: 1.3, siteLongitude: 103.85, latestPhotoUri: null },
  { id: "archived-1", name: "Old warehouse", status: "archived", projectStatus: "completed", siteAddress: "1 Pioneer Road", siteLatitude: null, siteLongitude: null, latestPhotoUri: null },
];
const mockListProjectSummaries = jest.fn(async () => summaries);
const mockSetProjectStatus = jest.fn(async (_userId: string, projectId: string, status: string) => {
  summaries = summaries.map((project) => project.id === projectId ? { ...project, status } : project);
});
let resolvePosition: (value: unknown) => void;

jest.mock("expo-speech-recognition", () => ({
  ExpoSpeechRecognitionModule: { isRecognitionAvailable: () => false, requestPermissionsAsync: jest.fn(), start: jest.fn(), stop: jest.fn() },
  useSpeechRecognitionEvent: jest.fn(),
}));
jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getCurrentPositionAsync: jest.fn(() => new Promise((resolve) => { resolvePosition = resolve; })),
}));
jest.mock("../src/subscription/useSubscriptionAccess", () => ({
  useSubscriptionAccess: () => ({ canCreateRecords: true, message: "" }),
}));
jest.mock("../src/work/projectScreenStore", () => ({
  currentWeekStart: () => "2026-11-09",
  getProjectScreenStore: jest.fn(async () => ({
    listProjectSummaries: mockListProjectSummaries,
    listProjectGroups: jest.fn(async () => []),
    setProjectStatus: mockSetProjectStatus,
  })),
}));
jest.mock("../src/screens/ProjectDetailScreen", () => ({ ProjectDetailScreen: () => null }));
jest.mock("../src/screens/ProjectNameSheet", () => ({ ProjectNameSheet: () => null }));
jest.mock("../src/components/SwipeDownSheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { SwipeDownSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? React.createElement(View, null, children) : null };
});

function renderProjects() {
  return render(<ProjectsScreen account={{ id: "u1", email: "worker@example.com" } as never} onCreateAccount={jest.fn()} onSeePhotos={jest.fn()} />);
}

beforeEach(() => {
  summaries = [
    { id: "active-1", name: "Marina fitout", status: "active", projectStatus: "active", siteAddress: "10 Bayfront Avenue", siteLatitude: 1.3, siteLongitude: 103.85, latestPhotoUri: null },
    { id: "archived-1", name: "Old warehouse", status: "archived", projectStatus: "completed", siteAddress: "1 Pioneer Road", siteLatitude: null, siteLongitude: null, latestPhotoUri: null },
  ];
  jest.clearAllMocks();
});

test("project card keeps its site address and adds distance when current location arrives", async () => {
  const screen = renderProjects();
  expect(await screen.findByText("Address: 10 Bayfront Avenue")).toBeTruthy();
  expect(screen.queryByText("1.1 km")).toBeNull();

  resolvePosition({ coords: { latitude: 1.29, longitude: 103.85 } });

  expect(await screen.findByText("1.1 km")).toBeTruthy();
  expect(screen.getByText("Address: 10 Bayfront Avenue")).toBeTruthy();
});

test("project cards show Address: None when no address is saved", async () => {
  summaries = [{ ...summaries[0], siteAddress: null }];
  const screen = renderProjects();
  expect(await screen.findByText("Address: None")).toBeTruthy();
});

test("restoring from Archived refreshes the active projects immediately", async () => {
  const screen = renderProjects();
  await screen.findByText("Marina fitout");
  fireEvent.press(screen.getByLabelText("Filter projects"));
  fireEvent.press(screen.getByText("Archived"));
  expect(await screen.findByText("Old warehouse")).toBeTruthy();

  fireEvent.press(screen.getByText("Restore"));
  await waitFor(() => expect(mockSetProjectStatus).toHaveBeenCalledWith("u1", "archived-1", "active"));
  await waitFor(() => expect(screen.queryByText("Old warehouse")).toBeNull());
  fireEvent.press(screen.getAllByText("All")[0]);
  expect(await screen.findByText("Old warehouse")).toBeTruthy();
});
