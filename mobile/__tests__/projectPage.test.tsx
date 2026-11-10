import fs from "node:fs";
import path from "node:path";
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockListProjects = jest.fn(async () => [
  { id: "project-1111", userId: "u1", name: "1111.", description: "", hourlyRateCents: 0 },
  { id: "project-2222", userId: "u1", name: "2222.", description: "", hourlyRateCents: 0 },
]);

jest.mock("../src/work/projectScreenStore", () => ({
  getProjectScreenStore: async () => ({ listProjects: mockListProjects }),
}));
jest.mock("../src/screens/ProgressClaimReportsScreen", () => ({
  ProgressClaimReportsScreen: () => null,
}));

import { ProjectDetailScreen } from "../src/screens/ProjectDetailScreen";

test("project page renders only its picker and PDF action", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/screens/ProjectDetailScreen.tsx"), "utf8");
  expect(source).toMatch(/testID="project-picker"/);
  expect(source).toMatch(/testID="create-share-pdf"/);
  for (const removed of ["No sessions yet", "Sessions", "Photos", "Earlier reports", "Show sessions", "Pay rate", "This week", "CSV", "Status", "Project complete"]) {
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

  await waitFor(() => expect(screen.getByText("1111.")).toBeTruthy());
  fireEvent.press(screen.getByTestId("project-picker"));
  expect(screen.getByTestId("project-detail-picker-sheet")).toBeTruthy();
  fireEvent.press(screen.getByText("2222."));
  expect(onSelectProject).toHaveBeenCalledWith("project-2222");
});

test("PDF builder reads the Settings report period", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/screens/ProgressClaimReportsScreen.tsx"), "utf8");
  expect(source).toMatch(/loadReportPeriod\(userId\)/);
  expect(source).toMatch(/buildProjectPeriodReport/);
});

