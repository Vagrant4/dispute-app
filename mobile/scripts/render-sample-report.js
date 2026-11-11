/* Generates deliberately fictional data for visual PDF/HTML review only. */
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");
const ts = require("typescript");
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const source = readFileSync(join(__dirname, "..", "src", file), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function("exports", "module", "require", js)(module.exports, module, (request) => request.startsWith(".") ? load(join(file, "..", `${request}.ts`).replaceAll("\\", "/").replace(/^.*src\//, "")) : require(request));
  return module.exports;
}
const { buildProgressClaimSnapshot } = load("reports/progressClaimSnapshot.ts");
const { buildProgressClaimHtml } = load("reports/progressClaimHtml.ts");
const snapshot = buildProgressClaimSnapshot({
  generatedAt: "2026-11-11T15:04:00.000Z", claimPeriod: { start: "2026-11-10", end: "2026-11-12" },
  worker: { name: "SAMPLE DATA — not a real claim" }, client: { name: "Sample Client Pte Ltd" },
  project: { name: "SAMPLE DATA — not a real claim", currency: "SGD", siteAddress: "A deliberately long sample site address, 123 Example Industrial Avenue, Singapore 123456" },
  pay: { rateBasis: "daily", baseRateCents: 15000, normalWorkStartTime: "08:00", normalWorkEndTime: "17:00", overtimeMultiplier: 1.5, lunchMinutes: 60 },
  timeEntries: [
    { id: "sample-short-1", workDate: "2026-11-10", startTime: "2026-11-10T16:58:00+08:00", endTime: "2026-11-10T17:01:00+08:00", durationMinutes: 3, activity: "Short sample visit" },
    { id: "sample-full-2", workDate: "2026-11-11", startTime: "2026-11-11T07:55:00+08:00", endTime: "2026-11-11T19:20:00+08:00", durationMinutes: 685, activity: "A deliberately long sample activity description demonstrating whole-word wrapping in evidence reports" },
    { id: "sample-short-3", workDate: "2026-11-12", startTime: "2026-11-12T09:00:00+08:00", endTime: "2026-11-12T11:00:00+08:00", durationMinutes: 120, activity: "Short visit, no lunch deduction" },
  ],
  photoEvidence: [
    { id: "sample-photo-with-a-very-long-evidence-identifier-00000001", timeEntryId: "sample-full-2", localUri: "file:///private/sample.jpg", caption: "Sample sealed-phone photo", capturedAt: "2026-11-11T06:25:09.379Z", lockHash: "0123456789abcdef0123456789abcdef" },
    { id: "sample-photo-with-a-very-long-evidence-identifier-00000002", timeEntryId: "sample-full-2", localUri: "data:image/jpeg;base64,AA==", caption: "Embedded sample photo", capturedAt: "2026-11-11T06:30:00.000Z", lockHash: "abcdef0123456789abcdef0123456789" },
  ],
});
snapshot.title = "SAMPLE DATA — not a real claim";
const output = process.argv[2]; if (!output) throw new Error("Usage: node scripts/render-sample-report.js OUTPUT.html");
mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, buildProgressClaimHtml(snapshot));
