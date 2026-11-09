import fs from "node:fs";
import path from "node:path";

test("project page renders only its picker and PDF action", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/screens/ProjectDetailScreen.tsx"), "utf8");
  expect(source).toMatch(/testID="project-picker"/);
  expect(source).toMatch(/testID="create-share-pdf"/);
  for (const removed of ["No sessions yet", "Sessions", "Photos", "Earlier reports", "Show sessions", "Pay rate", "This week", "CSV", "Status", "Project complete"]) {
    expect(source).not.toContain(removed);
  }
});

test("PDF builder reads the Settings report period", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/screens/ProgressClaimReportsScreen.tsx"), "utf8");
  expect(source).toMatch(/loadReportPeriod\(userId\)/);
  expect(source).toMatch(/buildProjectPeriodReport/);
});

