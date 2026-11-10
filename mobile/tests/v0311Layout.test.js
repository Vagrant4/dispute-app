const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./locationTestHelpers");

const { getTodayClockLayout } = createLoader()("src/layout/todayClockLayout.ts");

for (const [width, height] of [[360, 640], [390, 844], [412, 915], [344, 882]]) {
  test(`clock layout leaves a 20dp map gap at ${width}x${height}`, () => {
    const layout = getTodayClockLayout(width, height);
    assert.ok(layout.size >= 132 && layout.size <= 176);
    assert.ok(layout.mapGap >= 20);
  });
}
