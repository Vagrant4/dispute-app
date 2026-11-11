import fs from "node:fs";
import path from "node:path";
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

const mockListProjects = jest.fn(async () => [
  { id: "project-1111", userId: "u1", name: "1111.", description: "", siteAddress: "531377", hourlyRateCents: 0 },
  { id: "project-2222", userId: "u1", name: "2222.", description: "", hourlyRateCents: 0 },
]);
const mockSetProjectStatus = jest.fn(async () => undefined);
const mockUpdateProjectDiscovery = jest.fn(async () => undefined);
const mockGeocodeAsync = jest.fn(async () => [{ latitude: 1.31, longitude: 103.86 }]);

jest.mock("expo-location", () => ({
  __esModule: true,
  geocodeAsync: (...args: unknown[]) => mockGeocodeAsync(...args),
}));

jest.mock("../src/work/projectScreenStore", () => ({
  getProjectScreenStore: async () => ({ listProjects: mockListProjects, setProjectStatus: mockSetProjectStatus, updateProjectDiscovery: mockUpdateProjectDiscovery }),
}));
jest.mock("../src/screens/ProgressClaimReportsScreen", () => ({
  ProgressClaimReportsScreen: () => null,
}));
jest.mock("../src/screens/PhotoEvidenceScreen", () => ({
  PhotoEvidenceScreen: () => null,
}));

import { ProjectDetailScreen } from "../src/screens/ProjectDetailScreen";

beforeEach(() => {
  jest.clearAllMocks();
});

test("project page renders only its picker and PDF action", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/screens/ProjectDetailScreen.tsx"), "utf8");
  expect(source).toMatch(/testID="project-picker"/);
  expect(source).toMatch(/testID="create-share-pdf"/);
  expect(source).toMatch(/testID="project-detail-actions"/);
  expect(source).toContain("Delete project");
  expect(source).toContain("all shifts, photos and reports are kept");
  expect(source).toMatch(/styles\.projectShiftRow/);
  expect(source).toMatch(/styles\.projectReportSection/);
  for (const removed of ["No sessions yet", "Sessions", "Earlier reports", "Show sessions", "Pay rate", "This week", "CSV", "Project complete"]) {
    expect(source).not.toContain(removed);
  }
});

test("project picker opens a project sheet and selects another project", async () => {
  const onSelectProject = jest.fn();
  const screen = render(
    <ProjectDetailScreen
      account={{ id: "u1", email: "shi@example.com" } as never}
      onCreateAccount={jest.fn()}
      onSelectProject={onSelectProject}
      projectId="project-1111"
    />,
  );

  await waitFor(() => expect(screen.getAllByText("1111.").length).toBeGreaterThan(0));
  fireEvent.press(screen.getByTestId("project-picker"));
  expect(screen.getByTestId("project-detail-picker-sheet")).toBeTruthy();
  fireEvent.press(screen.getByText("2222."));
  expect(onSelectProject).toHaveBeenCalledWith("project-2222");
});

test("project detail prefixes its displayed address", async () => {
  const screen = render(<ProjectDetailScreen account={{ id: "u1", email: "shi@example.com" } as never} onCreateAccount={jest.fn()} onSelectProject={jest.fn()} projectId="project-1111" />);
  expect(await screen.findByText("Address: 531377")).toBeTruthy();
});

test("delete opens the dark in-app archive dialog without a native alert", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  const screen = render(<ProjectDetailScreen account={{ id: "u1", email: "shi@example.com" } as never} onCreateAccount={jest.fn()} onSelectProject={jest.fn()} projectId="project-1111" />);
  await waitFor(() => screen.getByText("Delete project"));
  fireEvent.press(screen.getByText("Delete project"));
  expect(screen.getByTestId("archive-confirm-dialog")).toBeTruthy();
  expect(alert).not.toHaveBeenCalled();
});

test("archive dialog cancel closes without changing the project", async () => {
  const screen = render(<ProjectDetailScreen account={{ id: "u1", email: "shi@example.com" } as never} onCreateAccount={jest.fn()} onSelectProject={jest.fn()} projectId="project-1111" />);
  await waitFor(() => screen.getByText("Delete project"));
  fireEvent.press(screen.getByText("Delete project"));
  fireEvent.press(screen.getByTestId("archive-confirm-cancel"));
  expect(screen.queryByTestId("archive-confirm-dialog")).toBeNull();
  expect(mockSetProjectStatus).not.toHaveBeenCalled();
});

test("archive confirmation persists and returns to the project list", async () => {
  const onSelectProject = jest.fn();
  const screen = render(<ProjectDetailScreen account={{ id: "u1", email: "shi@example.com" } as never} onCreateAccount={jest.fn()} onSelectProject={onSelectProject} projectId="project-1111" />);
  await waitFor(() => screen.getByText("Delete project"));
  fireEvent.press(screen.getByText("Delete project"));
  fireEvent.press(screen.getByTestId("archive-confirm-archive"));
  await waitFor(() => expect(mockSetProjectStatus).toHaveBeenCalledWith("u1", "project-1111", "archived"));
  expect(onSelectProject).toHaveBeenCalledWith("");
});

test("archive failure stays on detail and shows a visible error", async () => {
  mockSetProjectStatus.mockRejectedValueOnce(new Error("database unavailable"));
  const onSelectProject = jest.fn();
  const screen = render(<ProjectDetailScreen account={{ id: "u1", email: "shi@example.com" } as never} onCreateAccount={jest.fn()} onSelectProject={onSelectProject} projectId="project-1111" />);
  await waitFor(() => screen.getByText("Delete project"));
  fireEvent.press(screen.getByText("Delete project"));
  fireEvent.press(screen.getByTestId("archive-confirm-archive"));
  await waitFor(() => expect(screen.getByText("Could not archive this project. Try again.")).toBeTruthy());
  expect(onSelectProject).not.toHaveBeenCalled();
});

test("Save starts disabled, becomes enabled for address edits, and disables when reverted", async () => {
  const screen = render(<ProjectDetailScreen account={{ id: "u1", email: "shi@example.com" } as never} onCreateAccount={jest.fn()} onSelectProject={jest.fn()} projectId="project-1111" />);
  const save = await screen.findByTestId("project-detail-save");
  expect(save).toHaveProp("accessibilityLabel", "Save");
  expect(save).toHaveProp("accessibilityState", { disabled: true });
  fireEvent.changeText(screen.getByLabelText("Site address"), "10 Bayfront Avenue");
  expect(save).toHaveProp("accessibilityState", { disabled: false });
  fireEvent.changeText(screen.getByLabelText("Site address"), " 531377 ");
  expect(save).toHaveProp("accessibilityState", { disabled: true });
});

test("status changes are unsaved form edits", async () => {
  const screen = render(<ProjectDetailScreen account={{ id: "u1", email: "shi@example.com" } as never} onCreateAccount={jest.fn()} onSelectProject={jest.fn()} projectId="project-1111" />);
  const save = await screen.findByTestId("project-detail-save");
  fireEvent.press(screen.getByText("Completed"));
  expect(save).toHaveProp("accessibilityState", { disabled: false });
  expect(mockUpdateProjectDiscovery).not.toHaveBeenCalled();
});

test("saving a site confirms the saved address and resets its dirty state", async () => {
  const screen = render(<ProjectDetailScreen account={{ id: "u1", email: "shi@example.com" } as never} onCreateAccount={jest.fn()} onSelectProject={jest.fn()} projectId="project-1111" />);
  await screen.findByTestId("project-detail-save");
  fireEvent.changeText(screen.getByLabelText("Site address"), "10 Bayfront Avenue");
  fireEvent.press(screen.getByTestId("project-detail-save"));
  await waitFor(() => expect(mockUpdateProjectDiscovery).toHaveBeenCalledWith("u1", "project-1111", expect.objectContaining({ siteAddress: "10 Bayfront Avenue", siteLatitude: 1.31, siteLongitude: 103.86 })));
  expect(screen.getByTestId("project-detail-save")).toHaveProp("accessibilityState", { disabled: true });
  expect(screen.getByTestId("save-site-confirmation")).toHaveTextContent("Saved ✓");
});

test("a geocode failure saves an address without stale coordinates and explains the missing distance", async () => {
  mockGeocodeAsync.mockResolvedValueOnce([]);
  const screen = render(<ProjectDetailScreen account={{ id: "u1", email: "shi@example.com" } as never} onCreateAccount={jest.fn()} onSelectProject={jest.fn()} projectId="project-1111" />);
  await screen.findByTestId("project-detail-save");
  fireEvent.changeText(screen.getByLabelText("Site address"), "Unknown place");
  fireEvent.press(screen.getByTestId("project-detail-save"));
  await waitFor(() => expect(mockUpdateProjectDiscovery).toHaveBeenCalledWith("u1", "project-1111", expect.objectContaining({ siteAddress: "Unknown place", siteLatitude: null, siteLongitude: null })));
  expect(screen.getByText("Address saved. Couldn't locate it on the map, so distance isn't shown.")).toBeTruthy();
});

test("a site store failure is visible", async () => {
  mockUpdateProjectDiscovery.mockRejectedValueOnce(new Error("database unavailable"));
  const screen = render(<ProjectDetailScreen account={{ id: "u1", email: "shi@example.com" } as never} onCreateAccount={jest.fn()} onSelectProject={jest.fn()} projectId="project-1111" />);
  await screen.findByTestId("project-detail-save");
  fireEvent.changeText(screen.getByLabelText("Site address"), "failing address");
  fireEvent.press(screen.getByTestId("project-detail-save"));
  expect(await screen.findByText("Could not save the project site. Try again.")).toBeTruthy();
});

test("project detail calls the action Save, never Save site", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/screens/ProjectDetailScreen.tsx"), "utf8");
  expect(source).toContain('testID="project-detail-save"');
  expect(source).toContain('accessibilityLabel="Save"');
  expect(source).not.toContain("Save site");
});

test("project detail has no Tasks button and orders centred Save then Delete project", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/screens/ProjectDetailScreen.tsx"), "utf8");
  const save = source.indexOf('testID="project-detail-save"');
  const remove = source.indexOf('testID="project-detail-delete"');

  expect(source).not.toContain('testID="project-detail-tasks"');
  expect(source).not.toMatch(/>\s*Tasks\s*\(/);
  expect(save).toBeGreaterThan(-1);
  expect(remove).toBeGreaterThan(save);
  expect(source).toMatch(/style=\{\[styles\.actionButtonSecondary, \{ alignItems: "center" \}[\s\S]*?testID="project-detail-save"[\s\S]*?\{ textAlign: "center" \}/);
  expect(source).toMatch(/style=\{\[styles\.dangerButtonSecondary, \{ alignItems: "center" \}[\s\S]*?testID="project-detail-delete"[\s\S]*?\{ textAlign: "center" \}/);
});

test("PDF builder reads the Settings report period", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/screens/ProgressClaimReportsScreen.tsx"), "utf8");
  expect(source).toMatch(/loadReportPeriod\(userId\)/);
  expect(source).toMatch(/buildProjectPeriodReport/);
});

