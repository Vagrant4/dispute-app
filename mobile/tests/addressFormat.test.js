const assert = require("node:assert/strict");
const test = require("node:test");
const { createLoader } = require("./locationTestHelpers");

const {
  formatReadableAddress,
  formatCoordinateLabel,
  shortAddress,
  isHouseNumberOnly,
} = createLoader()("src/work/addressFormat.ts");

test("formatReadableAddress drops sparse number+country geocodes", () => {
  assert.equal(
    formatReadableAddress({ name: "377", city: "Singapore", country: "Singapore" }),
    null,
  );
  assert.equal(
    formatReadableAddress({
      streetNumber: "12",
      street: "Bayfront Ave",
      district: "Marina Bay",
      city: "Singapore",
      country: "Singapore",
    }),
    "12 Bayfront Ave, Marina Bay, Singapore",
  );
  assert.equal(isHouseNumberOnly("377"), true);
  assert.equal(isHouseNumberOnly("12 Bayfront Ave"), false);
  assert.equal(formatCoordinateLabel(-1.3, 103.8), "1.30° S, 103.80° E");
  assert.equal(shortAddress({ address: "377, Singapore" }), null);
  assert.match(
    formatReadableAddress({ name: "#01-01", streetNumber: "1", street: "Havelock Square", country: "Singapore" }),
    /^1 Havelock Square/,
  );
});
