import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";

Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });

const mockCamera = jest.fn();
const mockImport = jest.fn();
const mockGps = jest.fn();
const mockSeal = jest.fn();
const mockInsert = jest.fn();
let mockSavedRows: any[] = [];
const mockGetLocalRepositories = jest.fn(async () => ({
  work: { listProjects: async () => [{ id: "archived", userId: "u1", name: "Archived project", status: "archived", siteAddress: "531377" }, { id: "project-1", userId: "u1", name: "1111.", status: "active" }, { id: "project-2", userId: "u1", name: "Other project", status: "active" }], getHomeState: async () => ({ activeEntry: null, recentEntries: [] }) },
  photoEvidence: {
    listRecentPhotoEvidence: async () => mockSavedRows,
    insertPhotoEvidence: (...args: unknown[]) => mockInsert(...args),
    deletePhotoEvidence: jest.fn(),
  },
}));

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: async () => ({ granted: true }),
  requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
  launchCameraAsync: (...args: unknown[]) => mockCamera(...args),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("../src/photos/photoFileStorage", () => ({
  buildEvidencePhotoPath: () => "file:///evidence/photo.jpg",
  deleteEvidencePhotoFile: jest.fn(),
  importEvidencePhotoFile: (...args: unknown[]) => mockImport(...args),
}));
jest.mock("../src/photos/photoGps", () => ({ getOptionalPhotoGps: (...args: unknown[]) => mockGps(...args) }));
jest.mock("../src/photos/photoSeal", () => ({
  photoCaptureMetadata: () => ({ capturedAt: "2026-11-10T00:00:00.000Z", captureSource: "camera", captureTimeSource: "device_clock" }),
  photoSealBadge: () => "Sealed on this phone",
  photoTimeLabel: () => "8:00 AM",
  sealPhoto: (...args: unknown[]) => mockSeal(...args),
}));
jest.mock("../src/subscription/useSubscriptionAccess", () => ({ useSubscriptionAccess: () => ({ canCreateRecords: true, hasCurrentCreateAccess: () => true, message: "" }) }));
jest.mock("../src/db/repositories", () => ({ getLocalRepositories: (...args: unknown[]) => mockGetLocalRepositories(...args) }));

import { PhotoEvidenceScreen } from "../src/screens/PhotoEvidenceScreen";

beforeEach(() => {
  mockSavedRows = [];
  mockCamera.mockReset();
  mockGetLocalRepositories.mockClear();
  mockImport.mockReset().mockResolvedValue({ localUri: "file:///evidence/photo.jpg", copied: true });
  mockGps.mockReset().mockResolvedValue({ coordinates: null, message: "No GPS", blocked: false });
  mockSeal.mockReset().mockResolvedValue({ lockHash: "hash", lockedAt: "2026-11-10T00:00:01.000Z" });
  mockInsert.mockReset().mockImplementation(async (row: any) => { mockSavedRows = [{ ...row, user_id: row.userId, project_id: row.projectId, local_uri: row.localUri, captured_at: row.timestamp, capture_source: row.captureSource, capture_time_source: row.captureTimeSource, evidence_type: row.evidenceType, gps_latitude: null, gps_longitude: null }]; });
});

test("camera asset shows proof preview, saves, and appears in the list", async () => {
  mockCamera.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/camera.jpg" }] });
  const screen = render(<PhotoEvidenceScreen account={{ id: "u1", email: "worker@example.com" } as never} />);
  await waitFor(() => expect(screen.getByLabelText("Take photo")).toBeTruthy());
  fireEvent.press(screen.getByLabelText("Take photo"));
  await waitFor(() => expect(screen.getByTestId("photo-proof-sheet")).toBeTruthy());
  expect(screen.getByLabelText("Selected evidence preview")).toBeTruthy();
  fireEvent.press(screen.getByText("Save"));
  await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByText("Photo saved.")).toBeTruthy());
  expect(screen.getByLabelText(/Open photo:/)).toBeTruthy();
  expect(screen.getByTestId("photo-seal-icon")).toBeTruthy();
  expect(screen.getByTestId("photo-delete-icon")).toBeTruthy();
});

test("camera action renders a camera glyph instead of a bare dot", async () => {
  const screen = render(<PhotoEvidenceScreen account={{ id: "u1", email: "worker@example.com" } as never} />);
  await waitFor(() => expect(screen.getByTestId("camera-fab-glyph")).toBeTruthy());
  expect(screen.queryByText("●")).toBeNull();
});

test("project-scoped gallery excludes global headers and other project filters", async () => {
  const screen = render(<PhotoEvidenceScreen account={{ id: "u1", email: "worker@example.com" } as never} initialProjectId="project-1" projectScoped />);
  await waitFor(() => expect(screen.getByLabelText("Take photo")).toBeTruthy());
  expect(screen.queryByText("Other project")).toBeNull();
  expect(screen.queryByText("All")).toBeNull();
  expect(screen.queryByText("1111.")).toBeNull();
});

test("photos excludes archived projects from filters and capture defaults", async () => {
  const screen = render(<PhotoEvidenceScreen account={{ id: "u1", email: "worker@example.com" } as never} initialProjectId="archived" />);
  await waitFor(() => expect(screen.getByText("All")).toBeTruthy());
  expect(screen.queryByText("Archived project")).toBeNull();
  fireEvent(screen.getByLabelText("Take photo"), "longPress");
  await waitFor(() => expect(screen.getByTestId("photo-proof-sheet")).toBeTruthy());
  expect(screen.queryByText("Archived project")).toBeNull();
});

test("photos uses name-only single-line chips and an All projects header", async () => {
  const screen = render(<PhotoEvidenceScreen account={{ id: "u1", email: "worker@example.com" } as never} />);
  await waitFor(() => expect(screen.getByText("All projects")).toBeTruthy());
  expect(screen.queryByText("531377")).toBeNull();
  const chip = screen.getByText("1111.");
  expect(chip.props.numberOfLines).toBe(1);
  expect(chip.props.ellipsizeMode).toBe("tail");
  fireEvent.press(chip);
  await waitFor(() => expect(screen.getAllByText("1111.").length).toBe(2));
  expect(screen.queryByText(/1111\.\s*·/)).toBeNull();
});

test("seal failure shows Retry and retry succeeds without retaking", async () => {
  mockCamera.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/camera.jpg" }] });
  mockSeal.mockRejectedValueOnce(new Error("seal failed")).mockResolvedValueOnce({ lockHash: "hash", lockedAt: "now" });
  const screen = render(<PhotoEvidenceScreen account={{ id: "u1", email: "worker@example.com" } as never} />);
  await waitFor(() => screen.getByLabelText("Take photo"));
  fireEvent.press(screen.getByLabelText("Take photo"));
  await waitFor(() => screen.getByText("Save"));
  fireEvent.press(screen.getByText("Save"));
  await waitFor(() => expect(screen.getByText("Retry")).toBeTruthy());
  fireEvent.press(screen.getByText("Retry"));
  await waitFor(() => expect(screen.getByText("Photo saved.")).toBeTruthy());
});

test("database insert failure stays in the sheet and Retry succeeds", async () => {
  mockCamera.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/camera.jpg" }] });
  const normalInsert = mockInsert.getMockImplementation();
  mockInsert.mockRejectedValueOnce(new Error("db failed")).mockImplementationOnce(normalInsert!);
  const screen = render(<PhotoEvidenceScreen account={{ id: "u1", email: "worker@example.com" } as never} />);
  await waitFor(() => screen.getByLabelText("Take photo"));
  fireEvent.press(screen.getByLabelText("Take photo"));
  await waitFor(() => screen.getByText("Save"));
  fireEvent.press(screen.getByText("Save"));
  await waitFor(() => expect(screen.getByText("Retry")).toBeTruthy());
  expect(screen.getByTestId("photo-proof-sheet")).toBeTruthy();
  fireEvent.press(screen.getByText("Retry"));
  await waitFor(() => expect(screen.getByText("Photo saved.")).toBeTruthy());
});

test("canceled camera leaves no proof sheet open", async () => {
  mockCamera.mockResolvedValue({ canceled: true, assets: [] });
  const screen = render(<PhotoEvidenceScreen account={{ id: "u1", email: "worker@example.com" } as never} />);
  await waitFor(() => screen.getByLabelText("Take photo"));
  fireEvent.press(screen.getByLabelText("Take photo"));
  await waitFor(() => expect(mockCamera).toHaveBeenCalledTimes(1));
  expect(screen.queryByText("No photo selected. Nothing was saved.")).toBeNull();
  expect(screen.queryByTestId("photo-proof-sheet")).toBeNull();
});
