const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./locationTestHelpers");

const load = createLoader();

test("break maths handles single, multiple, restart, clock-out, and minute rounding", () => {
  const { closeOpenBreak, summarizeBreaks } = load("src/work/shiftTimeline.ts");
  const intervals = [
    { startedAt: "2026-11-10T01:00:00.000Z", endedAt: "2026-11-10T01:01:29.000Z" },
    { startedAt: "2026-11-10T02:00:00.000Z", endedAt: null },
  ];
  assert.equal(summarizeBreaks(intervals, new Date("2026-11-10T02:02:31.000Z")).seconds, 240);
  assert.equal(summarizeBreaks(intervals, new Date("2026-11-10T02:02:31.000Z")).minutes, 4);
  const closed = closeOpenBreak(intervals, new Date("2026-11-10T02:02:31.000Z"));
  assert.equal(closed[1].endedAt, "2026-11-10T02:02:31.000Z");
  assert.equal(summarizeBreaks(closed).minutes, 4);
});

test("task segments switch repeatedly and subtract overlapping breaks", () => {
  const { buildTaskSegments } = load("src/work/shiftTimeline.ts");
  const segments = buildTaskSegments({
    shiftStart: "2026-11-10T01:00:00.000Z",
    shiftEnd: "2026-11-10T03:00:00.000Z",
    switches: [
      { taskId: "a", at: "2026-11-10T01:00:00.000Z" },
      { taskId: "b", at: "2026-11-10T02:00:00.000Z" },
      { taskId: "a", at: "2026-11-10T02:30:00.000Z" },
    ],
    breaks: [
      { startedAt: "2026-11-10T01:45:00.000Z", endedAt: "2026-11-10T02:15:00.000Z" },
      { startedAt: "2026-11-10T02:40:00.000Z", endedAt: "2026-11-10T02:50:00.000Z" },
    ],
  });
  assert.deepEqual(segments.map((segment) => [segment.taskId, segment.durationMinutes]), [["a", 45], ["b", 15], ["a", 20]]);
  assert.equal(segments.reduce((sum, segment) => sum + segment.durationMinutes, 0), 80);
});

test("pay and report totals use worked minutes after breaks", () => {
  const { workedMinutes } = load("src/work/shiftTimeline.ts");
  assert.equal(workedMinutes("2026-11-10T01:00:00.000Z", "2026-11-10T03:00:00.000Z", 30), 90);
  assert.equal(Math.round(workedMinutes("2026-11-10T01:00:00.000Z", "2026-11-10T03:00:00.000Z", 30) / 60 * 2000), 3000);
});

test("location retry opens settings only for denied or services off", () => {
  const { locationRetryAction } = createLoader({ "expo-location": {} })("src/work/workLocation.ts");
  assert.equal(locationRetryAction("timeout"), "retry");
  assert.equal(locationRetryAction("unavailable"), "retry");
  assert.equal(locationRetryAction("denied"), "settings");
  assert.equal(locationRetryAction("services_off"), "settings");
});
