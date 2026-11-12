import fs from "node:fs";
import path from "node:path";

test("back handling is ordered sheet, inner page, tab, then double-back exit", () => {
  const root = path.resolve(__dirname, "..");
  const app = fs.readFileSync(path.join(root, "App.tsx"), "utf8");
  const home = fs.readFileSync(path.join(root, "src/screens/HomeScreen.tsx"), "utf8");
  const projects = fs.readFileSync(path.join(root, "src/screens/ProjectsScreen.tsx"), "utf8");
  const settings = fs.readFileSync(path.join(root, "src/screens/SettingsScreen.tsx"), "utf8");
  expect(home).toMatch(/projectSheetOpen[\s\S]*setProjectSheetOpen\(false\)/);
  expect(projects).toMatch(/openProjectId[\s\S]*setOpenProjectId\(null\)/);
  expect(settings).toMatch(/panel !== "main"/);
  expect(app).toMatch(/activeTab !== "home"[\s\S]*setActiveTab\("home"\)/);
  expect(app).toMatch(/Press back again to exit/);
});
