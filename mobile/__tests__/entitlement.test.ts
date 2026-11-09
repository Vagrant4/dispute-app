import { canExportProgressClaim } from "../src/subscription/subscriptionClient";
import { getDisputePackExportAccess } from "../src/subscription/recordAccess";
import fs from "node:fs";
import path from "node:path";

const now = Date.parse("2026-11-09T00:00:00Z");
const base: any = {
  userId: "shi", status: "TRIALING", isActive: true,
  canCreateRecords: true, canExportReports: true,
  trialEndsAt: "2026-12-09T00:00:00Z", currentPeriodEnd: null,
};

test("extended trial unlocks PDF and CSV", () => {
  expect(canExportProgressClaim(base, now)).toBe(true);
  expect(getDisputePackExportAccess({ isGuest: false, entitlement: base, nowMs: now }).canExport).toBe(true);
});

test("expired trial without subscription locks PDF and CSV", () => {
  const expired = { ...base, status: "EXPIRED", isActive: false, canCreateRecords: false, canExportReports: false, trialEndsAt: "2026-11-08T00:00:00Z" };
  expect(canExportProgressClaim(expired, now)).toBe(false);
  expect(getDisputePackExportAccess({ isGuest: false, entitlement: expired, nowMs: now }).canExport).toBe(false);
});

test("active subscription unlocks PDF and CSV", () => {
  const active = { ...base, status: "ACTIVE", trialEndsAt: null, currentPeriodEnd: "2026-12-09T00:00:00Z" };
  expect(canExportProgressClaim(active, now)).toBe(true);
  expect(getDisputePackExportAccess({ isGuest: false, entitlement: active, nowMs: now }).canExport).toBe(true);
});

test("Today and the project PDF gate read the same entitlement source", () => {
  const root = path.resolve(__dirname, "../src");
  const today = fs.readFileSync(path.join(root, "screens/HomeScreen.tsx"), "utf8");
  const reports = fs.readFileSync(path.join(root, "screens/ProgressClaimReportsScreen.tsx"), "utf8");
  expect(today).toMatch(/useSubscriptionAccess\(account\)/);
  expect(reports).toMatch(/useSubscriptionAccess\(account\)/);
  expect(reports).not.toMatch(/fetchSubscriptionStatus/);
});

test("successful purchase or restore sync notifies the shared source", () => {
  const client = fs.readFileSync(path.resolve(__dirname, "../src/subscription/subscriptionClient.ts"), "utf8");
  const hook = fs.readFileSync(path.resolve(__dirname, "../src/subscription/useSubscriptionAccess.ts"), "utf8");
  expect(client).toMatch(/requestEntitlementRefresh\(\)/);
  expect(hook).toMatch(/subscribeToEntitlementRefresh/);
});

