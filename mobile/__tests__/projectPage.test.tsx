import fs from "node:fs";
import path from "node:path";
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

const mockListProjects = jest.fn(async () => [
  { id: "project-1111", userId: "u1", name: "1111.", description: "", hourlyRateCents: 0 },
  { id: "project-2222", userId: "u1", name: "2222.", description: "", hourlyRateCents: 0 },
]);
const mockSetProjectStatus = jest.fn(async () => undefined);

jest.mock("../src/work/projectScreenStore", () => ({
  getProjectScreenStore: async () => ({ listProjects: mockListProjects, setProjectStatus: mockSetProjectStatus }),
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

test("PDF builder reads the Settings report period", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/screens/ProgressClaimReportsScreen.tsx"), "utf8");
  expect(source).toMatch(/loadReportPeriod\(userId\)/);
  expect(source).toMatch(/buildProjectPeriodReport/);
});

