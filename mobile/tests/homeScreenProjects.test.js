const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadProjectDraft() {
  const source = readFileSync(
    path.join(__dirname, "..", "src", "work", "projectDraft.ts"),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "module", "require", compiled)(
    module.exports,
    module,
    require,
  );
  return module.exports;
}

const { getProjectSaveMode, startNewProjectDraft } = loadProjectDraft();

test("new project action clears the selected project into an editable create draft", () => {
  const result = startNewProjectDraft({
    hasCreateAccess: true,
    isClockRunning: false,
  });
  assert.deepEqual(result, {
    ok: true,
    selectedProjectId: null,
    projectName: "",
    projectDescription: "",
    message: "Enter the new project details, then tap Create Project.",
  });
  assert.equal(getProjectSaveMode(result.selectedProjectId), "create");
  assert.equal(getProjectSaveMode("existing-project"), "update");
});

test("new project action rejects expired access and an active clock", () => {
  assert.deepEqual(
    startNewProjectDraft({ hasCreateAccess: false, isClockRunning: false }),
    {
      ok: false,
      message: "An active trial or subscription is required to create a new project.",
    },
  );
  assert.deepEqual(
    startNewProjectDraft({ hasCreateAccess: true, isClockRunning: true }),
    { ok: false, message: "Time Out before creating a new project." },
  );
});
