const assert = require("node:assert/strict");
const test = require("node:test");

test("mobile can import shared ClaimProof utilities", async () => {
  const shared = await import("@claimproof/shared");

  assert.equal(
    shared.calculateTotalHours(
      new Date("2026-06-07T08:00:00+08:00"),
      new Date("2026-06-07T17:00:00+08:00"),
      60,
    ),
    8,
  );
  assert.deepEqual(shared.GENERATED_DOCUMENT_TYPES, [
    "progress_claim_pdf",
    "progress_claim_csv",
  ]);
});
