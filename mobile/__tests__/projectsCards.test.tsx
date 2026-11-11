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
const mockGeocodeAsync = jest.fn(async () => [{ latitude: 1.3, longitude: 103.85 }]);
const mockCreateProject = jest.fn(async () => ({ id: "new-project" }));
let resolvePosition: (value: unknown) => void;
const mockLastKnownPosition = jest.fn();

jest.mock("expo-speech-recognition", () => ({
  ExpoSpeechRecognitionModule: { isRecognitionAvailable: () => false, requestPermissionsAsync: jest.fn(), start: jest.fn(), stop: jest.fn() },
  useSpeechRecognitionEvent: jest.fn(),
}));
jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getLastKnownPositionAsync: (...args: unknown[]) => mockLastKnownPosition(...args),
  getCurrentPositionAsync: jest.fn(() => new Promise((resolve) => { resolvePosition = resolve; })),
  geocodeAsync: (...args: unknown[]) => mockGeocodeAsync(...args),
}));
jest.mock("../src/subscription/useSubscriptionAccess", () => ({
  useSubscriptionAccess: () => ({ canCreateRecords: true, message: "" }),
}));
jest.mock("../src/work/projectScreenStore", () => ({
  currentWeekStart: () => "2026-11-09",
  getProjectScreenStore: jest.fn(async () => ({
    listProjectSummaries: mockListProjectSummaries,
    listProjectGroups: jest.fn(async () => []),
    listClients: jest.fn(async () => [{ id: "client-1" }]),
    createProject: (...args: unknown[]) => mockCreateProject(...args),
    setProjectStatus: mockSetProjectStatus,
  })),
}));
jest.mock("../src/screens/ProjectDetailScreen", () => ({ ProjectDetailScreen: ({ initialSiteNotice }: { initialSiteNotice?: string }) => {
  const React = require("react");
  const { Text } = require("react-native");
  return React.createElement(Text, null, initialSiteNotice);
} }));
jest.mock("../src/screens/ProjectNameSheet", () => ({ ProjectNameSheet: ({ onSave }: { onSave: (name: string, address: string) => Promise<void> }) => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");
  return React.createElement(Pressable, { testID: "save-new-project", onPress: () => void onSave("New job", "Unknown place") }, React.createElement(Text, null, "Save new project"));
} }));
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
  mockLastKnownPosition.mockResolvedValue(null);
  mockGeocodeAsync.mockResolvedValue([{ latitude: 1.3, longitude: 103.85 }]);
});

test("project card shows distance from the last known location without a fresh fix", async () => {
  mockLastKnownPosition.mockResolvedValue({ coords: { latitude: 1.29, longitude: 103.85 } });
  const screen = renderProjects();
  await waitFor(() => expect(mockLastKnownPosition).toHaveBeenCalled());
  expect(await screen.findByText("1.1 km")).toBeTruthy();
});

test("a fresh location updates the last known distance", async () => {
  mockLastKnownPosition.mockResolvedValue({ coords: { latitude: 1.29, longitude: 103.85 } });
  const screen = renderProjects();
  expect(await screen.findByText("1.1 km")).toBeTruthy();
  resolvePosition({ coords: { latitude: 1.3, longitude: 103.85 } });
  expect(await screen.findByText("0 m")).toBeTruthy();
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
  expect(screen.getAllByText("Archived").length).toBeGreaterThan(1);

  fireEvent.press(screen.getByText("Restore"));
  await waitFor(() => expect(mockSetProjectStatus).toHaveBeenCalledWith("u1", "archived-1", "active"));
  await waitFor(() => expect(screen.queryByText("Old warehouse")).toBeNull());
  fireEvent.press(screen.getAllByText("All")[0]);
  expect(await screen.findByText("Old warehouse")).toBeTruthy();
});

test("a new project with a failed geocode opens with a calm distance notice", async () => {
  mockGeocodeAsync.mockResolvedValueOnce([]);
  const screen = renderProjects();
  fireEvent.press(await screen.findByText("+ Add project"));
  fireEvent.press(screen.getByTestId("save-new-project"));
  expect(await screen.findByText("Address saved. Couldn't locate it on the map, so distance isn't shown.")).toBeTruthy();
  expect(mockCreateProject).toHaveBeenCalledWith(expect.objectContaining({ siteAddress: "Unknown place", siteLatitude: undefined, siteLongitude: undefined }));
});
