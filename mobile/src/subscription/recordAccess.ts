import type { SubscriptionEntitlement } from "./subscriptionClient";

const PAID_STATUSES = new Set(["ACTIVE", "PAST_DUE", "CANCELED"]);

// A paid store subscription whose current billing period has not ended yet.
export function hasPaidSubscription(
  entitlement: SubscriptionEntitlement | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!entitlement || !PAID_STATUSES.has(entitlement.status)) return false;
  const periodEnd = entitlement.currentPeriodEnd ? Date.parse(entitlement.currentPeriodEnd) : Number.NaN;
  return Number.isFinite(periodEnd) && periodEnd > nowMs;
}

export type DisputePackLock = "guest" | "subscribe" | null;

export type DisputePackExportAccess = {
  canPreview: true;
  canExport: boolean;
  lock: DisputePackLock;
};

// Single gate for every dispute pack file action: create PDF/CSV, Share dispute
// pack, Download PDF, Email / Share, and opening a file in another app.
// The in-app report preview is always allowed.
export function getDisputePackExportAccess(params: {
  isGuest: boolean;
  entitlement: SubscriptionEntitlement | null | undefined;
  nowMs?: number;
}): DisputePackExportAccess {
  if (params.isGuest) return { canPreview: true, canExport: false, lock: "guest" };
  const entitlement = params.entitlement;
  const canExport =
    entitlement?.canExportReports === true &&
    entitlement.userId !== "local-user" &&
    hasCurrentEntitlement(entitlement, params.nowMs ?? Date.now());
  return { canPreview: true, canExport, lock: canExport ? null : "subscribe" };
}

export const disputePackLockContent = {
  title: "Dispute pack download is locked",
  body: "Downloading your dispute pack needs a subscription. Your records stay safe on this phone.",
  previewHint: "You can still preview the report on this screen.",
  guestTrialEnded: "Your 30-day free trial has ended. Create a free account to keep your records, then subscribe to continue.",
  guestButton: "Create account or sign in",
  subscribeButton: "Open Plan & billing",
  lockedStatus: "Locked: downloading your dispute pack needs a subscription. Your records stay safe on this phone.",
};

// Plan & billing hint shown under the price, so the lock card's
// "Open Plan & billing" button always lands on an explanation.
export function getDisputePackBillingNote(
  isGuest: boolean,
  action: "subscribe" | "manage" | "none",
  trialEndsAt: string | null,
): string | null {
  if (action === "manage") return null;
  if (isGuest) return "Downloading your dispute pack needs an account and a DISPUTE Basic subscription.";
  if (action === "subscribe") return "Subscribe to download and share your dispute pack.";
  const end = trialEndsAt ? new Date(trialEndsAt) : null;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const when = end && Number.isFinite(end.getTime())
    ? ` on ${end.getDate()} ${months[end.getMonth()]} ${end.getFullYear()}`
    : "";
  return `Downloading your dispute pack needs a DISPUTE Basic subscription. Subscribe opens here when your free trial ends${when}.`;
}

export function getRecordAccess(entitlement: SubscriptionEntitlement | null) {
  return {
    canView: true,
    canCreate: entitlement?.canCreateRecords === true,
    canExport: entitlement?.canExportReports === true && hasCurrentEntitlement(entitlement, Date.now()),
  };
}

function hasCurrentEntitlement(entitlement: SubscriptionEntitlement, nowMs: number): boolean {
  if (entitlement.status === "TRIALING") {
    const end = entitlement.trialEndsAt ? Date.parse(entitlement.trialEndsAt) : Number.NaN;
    return entitlement.canCreateRecords && Number.isFinite(end) && end > nowMs;
  }
  return hasPaidSubscription(entitlement, nowMs);
}

export function canClockOut(hasActiveEntry: boolean): boolean {
  return hasActiveEntry;
}
