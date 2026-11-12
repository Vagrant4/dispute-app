const assert = require("node:assert/strict");
const test = require("node:test");
const { createLoader } = require("./locationTestHelpers");
const { projectPickerLabel } = createLoader()("src/work/projectLabels.ts");

test("duplicate project names remain separate and receive distinct picker labels", () => {
  const projects = [{ id: "a", name: "Tester", siteAddress: "Hougang" }, { id: "b", name: "Tester", siteAddress: null }];
  assert.equal(projectPickerLabel(projects[0], projects), "Tester · Hougang");
  assert.equal(projectPickerLabel(projects[1], projects), "Tester · 2");
});
