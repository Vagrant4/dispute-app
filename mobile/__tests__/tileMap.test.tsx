import React from "react";
import { render } from "@testing-library/react-native";
import { LocationMap, TILE_CACHE_VERSION, TILE_USER_AGENT } from "../src/screens/LocationMap.native";

test("tile images carry the app User-Agent and versioned Fresco cache key", () => {
  const screen = render(<LocationMap reading={{ phase: "start", source: "gps", address: "Site", latitude: 1.284, longitude: 103.851, accuracy: 17, locatedAt: null }} />);
  const sources: Array<{ uri: string; headers: Record<string, string> }> = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const item = node as { props?: { source?: { uri?: string; headers?: Record<string, string> } }; children?: unknown[] };
    if (typeof item.props?.source?.uri === "string") sources.push(item.props.source as { uri: string; headers: Record<string, string> });
    item.children?.forEach(visit);
  };
  visit(screen.toJSON());
  const tiles = sources;
  expect(tiles.length).toBeGreaterThan(0);
  expect(tiles[0].headers["User-Agent"]).toBe(TILE_USER_AGENT);
  expect(tiles[0].uri).toContain(`#${TILE_CACHE_VERSION}`);
  expect(screen.getByText("© OpenStreetMap contributors")).toBeTruthy();
  expect(screen.queryByText("(c) OpenStreetMap contributors")).toBeNull();
  expect(screen.queryByText(/Open in Maps|View on map|±|meters/i)).toBeNull();
});
