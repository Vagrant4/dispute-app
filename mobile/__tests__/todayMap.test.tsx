import React from "react";
import { fireEvent, render, waitFor, within } from "@testing-library/react-native";

const mockGetLocation = jest.fn().mockResolvedValue({ address: "Raffles Place", addressParts: null, latitude: 1.284, longitude: 103.851, accuracy: 17, timestamp: "2026-11-09T00:00:00.000Z" });
jest.mock("../src/work/workLocation", () => ({ getWorkLocationWithTimeout: (...args: unknown[]) => mockGetLocation(...args) }));
jest.mock("../src/subscription/useSubscriptionAccess", () => ({ useSubscriptionAccess: () => ({ canCreateRecords: true, hasCurrentCreateAccess: () => true, subscription: null, message: "" }) }));
const mockWorkStore = { getHomeState: async () => ({ totalMinutesToday: 0, activeEntry: null, recentEntries: [] }), listProjects: async () => [], refreshLocation: jest.fn() };
jest.mock("../src/db/repositories", () => ({ getLocalRepositories: async () => ({ work: mockWorkStore }) }));
jest.mock("../src/work/webWorkStore", () => ({ webWorkStore: mockWorkStore }));

import { HomeScreen } from "../src/screens/HomeScreen";

test("Today renders a composed crosshair inside its live map and reveals the address after locating", async () => {
  mockGetLocation.mockClear();
  mockGetLocation.mockResolvedValue({ address: "Raffles Place", addressParts: null, latitude: 1.284, longitude: 103.851, accuracy: 17, timestamp: "2026-11-09T00:00:00.000Z" });
  const screen = render(<HomeScreen account={{ id: "u1", email: "worker@example.com" } as never} />);
  const map = screen.getByTestId("today-map");
  const locateButton = within(map).getByTestId("today-locate-button");
  expect(within(map).getByLabelText(/Street map/)).toBeTruthy();
  expect(screen.queryByText("No GPS reading yet. Tap the crosshair.")).toBeNull();
  expect(within(locateButton).getByTestId("today-locate-reticle")).toBeTruthy();
  expect(screen.queryByText("Raffles Place")).toBeNull();
  expect(screen.queryByText("Add your location")).toBeNull();
  expect(screen.queryByText("At your location")).toBeNull();
  await waitFor(() => expect(mockGetLocation).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(locateButton.props.disabled).not.toBe(true));
  expect(screen.queryByText("Raffles Place")).toBeNull();
  fireEvent.press(locateButton);
  await waitFor(() => expect(mockGetLocation).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(within(map).getByText("Raffles Place")).toBeTruthy());
});

test("Today exposes Add project and opens the existing project-name sheet", async () => {
  const screen = render(<HomeScreen account={{ id: "u1", email: "worker@example.com" } as never} />);
  const map = screen.getByTestId("today-map");
  const projectActions = screen.getByTestId("today-project-actions");
  await waitFor(() => expect(within(projectActions).getByTestId("today-add-project")).toBeTruthy());
  expect(within(map).queryByTestId("today-add-project")).toBeNull();
  expect(within(projectActions).getByLabelText("Choose a project")).toBeTruthy();
  fireEvent.press(within(projectActions).getByTestId("today-add-project"));
  expect(screen.getByTestId("project-sheet")).toBeTruthy();
});
