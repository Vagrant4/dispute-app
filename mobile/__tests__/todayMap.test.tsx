import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockGetLocation = jest.fn().mockResolvedValue({ address: "Raffles Place", addressParts: null, latitude: 1.284, longitude: 103.851, accuracy: 17, timestamp: "2026-11-09T00:00:00.000Z" });
jest.mock("../src/work/workLocation", () => ({ getWorkLocationWithTimeout: (...args: unknown[]) => mockGetLocation(...args) }));
jest.mock("../src/subscription/useSubscriptionAccess", () => ({ useSubscriptionAccess: () => ({ canCreateRecords: true, hasCurrentCreateAccess: () => true, subscription: null, message: "" }) }));
jest.mock("../src/db/repositories", () => ({ getLocalRepositories: async () => ({ work: { getHomeState: async () => ({ totalMinutesToday: 0, activeEntry: null, recentEntries: [] }), listProjects: async () => [] } }) }));

import { HomeScreen } from "../src/screens/HomeScreen";

test("Today renders its live map and locate button re-centres on a fresh fix", async () => {
  const screen = render(<HomeScreen account={{ id: "u1", email: "worker@example.com" } as never} />);
  expect(screen.getByTestId("today-map")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Show my location"));
  await waitFor(() => expect(mockGetLocation).toHaveBeenCalled());
  expect(screen.getByTestId("today-map")).toBeTruthy();
});
