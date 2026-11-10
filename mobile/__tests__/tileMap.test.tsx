import React from "react";
import { render } from "@testing-library/react-native";
import { LocationMap } from "../src/screens/LocationMap.native";

test("map uses Google without custom OSM tiles or attribution", () => {
  const screen = render(<LocationMap reading={{ phase: "start", source: "gps", address: "Site", latitude: 1.284, longitude: 103.851, accuracy: 17, locatedAt: null }} />);
  expect(screen.queryByText(/OpenStreetMap/)).toBeNull();
  expect(screen.queryByText(/Open in Maps|View on map|±|meters/i)).toBeNull();
});
