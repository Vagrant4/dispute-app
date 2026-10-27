import type { SubscriptionEntitlement } from "./subscriptionClient";

export function getRecordAccess(entitlement: SubscriptionEntitlement | null) {
  return {
    canView: true,
    canCreate: entitlement?.canCreateRecords === true,
    canExport: entitlement?.canExportReports === true,
  };
}

export function canClockOut(hasActiveEntry: boolean): boolean {
  return hasActiveEntry;
}
