import { clearInactiveProjectId, keepActiveProjectId, listActiveProjects, selectActiveProjects } from "../src/work/activeProjects";

const active = { id: "active", name: "Current", status: "active" } as never;
const archived = { id: "archived", name: "Old", status: "archived" } as never;

test("the shared picker source excludes archived projects", async () => {
  expect(selectActiveProjects([archived, active])).toEqual([active]);
  await expect(listActiveProjects({ listProjects: async () => [archived, active] }, "u1")).resolves.toEqual([active]);
});

test("remembered selections are retained only while their project is active", () => {
  expect(keepActiveProjectId([active], "active")).toBe("active");
  expect(keepActiveProjectId([active], "archived")).toBeNull();
  expect(keepActiveProjectId([active], "missing")).toBeNull();
  expect(clearInactiveProjectId([active], "archived")).toBeNull();
});
