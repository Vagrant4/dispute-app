const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ts = require("typescript");
const source = fs.readFileSync(path.join(__dirname, "../src/work/projectDiscovery.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleBox = { exports: {} };
new Function("module", "exports", compiled)(moduleBox, moduleBox.exports);
const api = moduleBox.exports;

test("formats site distance in metres and kilometres", () => {
  assert.equal(api.formatSiteDistance(846), "850 m");
  assert.equal(api.formatSiteDistance(2410), "2.4 km");
  assert.equal(api.formatSiteDistance(null), null);
});

test("searches name and address and treats legacy lead projects as active", () => {
  const rows = [
    { name: "Tower", siteAddress: "Raffles Place", projectStatus: "active", groupId: "g1" },
    { name: "Garden", siteAddress: "Jurong", projectStatus: "lead", groupId: "g2" },
  ];
  assert.deepEqual(api.filterProjects(rows, "raffles", "all", "all"), [rows[0]]);
  assert.equal(api.normalizeProjectStatus("lead"), "active");
  assert.deepEqual(api.filterProjects(rows, "", "active"), rows);
});

test("haversine returns a project-to-site distance", () => {
  const distance = api.haversineMetres({ latitude: 1.29, longitude: 103.85 }, { latitude: 1.30, longitude: 103.85 });
  assert.ok(distance > 1100 && distance < 1120);
});
