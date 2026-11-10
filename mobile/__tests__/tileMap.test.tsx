import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { LocationMap } from "../src/screens/LocationMap.native";

test("map uses Google without custom OSM tiles or attribution", () => {
  const screen = render(<LocationMap reading={{ phase: "start", source: "gps", address: "Site", latitude: 1.284, longitude: 103.851, accuracy: 17, locatedAt: null }} />);
  expect(screen.queryByText(/OpenStreetMap/)).toBeNull();
  expect(screen.queryByText(/Open in Maps|View on map|±|meters/i)).toBeNull();
});

test("Today never renders coordinates and shows the unavailable-address fallback", () => {
  const screen = render(<LocationMap showDetails reading={{ phase: "start", source: "gps", address: null, latitude: 1.36, longitude: 103.89, accuracy: 17, locatedAt: null }} />);
  expect(screen.queryByText(/1\.36.*103\.89/)).toBeNull();
  expect(screen.getByText("Address unavailable")).toBeTruthy();
  expect(screen.getByText("GPS pin is fixed · cannot be moved")).toBeTruthy();
});

test("map warns once when tiles do not load within ten seconds", () => {
  jest.useFakeTimers();
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  const screen = render(<LocationMap reading={null} />);
  fireEvent(screen.getByTestId("google-map"), "mapReady");
  act(() => { jest.advanceTimersByTime(10_000); });
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn).toHaveBeenCalledWith("[DISPUTE map] tiles_not_loaded", { code: "MAP_TILES_TIMEOUT" });
  warn.mockRestore();
  jest.useRealTimers();
});

test("map load cancels the tile timeout warning", () => {
  jest.useFakeTimers();
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  const screen = render(<LocationMap reading={null} />);
  fireEvent(screen.getByTestId("google-map"), "mapReady");
  fireEvent(screen.getByTestId("google-map"), "mapLoaded");
  act(() => { jest.advanceTimersByTime(10_000); });
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
  jest.useRealTimers();
});
