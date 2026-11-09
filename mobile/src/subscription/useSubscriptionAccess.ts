import { useCallback, useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import {
  fetchSubscriptionStatus,
  hasCurrentFullAccess,
  type SubscriptionEntitlement,
} from "./subscriptionClient";
import type { LocalAccount } from "../auth/localAuth";
import { buildGuestEntitlement, type GuestTrialState, guestTrialStatus, loadGuestTrial, observeClock, saveGuestTrial, startGuestTrial } from "./guestTrial";

export function useSubscriptionAccess(account: LocalAccount) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const { subscription, message, nowMs, guestState } = state.accountId === account.id ? state : EMPTY_STATE;

  const refresh = useCallback(async () => {
    if (account.isGuest) {
      const now = Date.now();
      const state = observeClock(startGuestTrial(now, await loadGuestTrial()), now);
      await saveGuestTrial(state);
      const entitlement = buildGuestEntitlement(state, now);
      publish({ accountId: account.id, subscription: entitlement, message: entitlement.message, nowMs: now, guestState: state });
      return entitlement;
    }
    const result = await fetchSubscriptionStatus(account.id);
    if (!result.ok) {
      publish({ accountId: account.id, subscription: null, message: result.message, nowMs: Date.now(), guestState: null });
      return null;
    }
    publish({ accountId: account.id, subscription: result.subscription, message: result.subscription.message, nowMs: Date.now(), guestState: null });
    return result.subscription;
  }, [account.id, account.isGuest]);

  useEffect(() => {
    const initialRefresh = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => {
      publish({ ...getSnapshot(), nowMs: Date.now() });
      if (account.isGuest) void refresh();
    }, 30_000);
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        publish({ ...getSnapshot(), nowMs: Date.now() });
        void refresh();
      }
    });
    return () => {
      clearTimeout(initialRefresh);
      clearInterval(timer);
      appState.remove();
    };
  }, [refresh]);

  const canCreateRecords = hasCurrentFullAccess(subscription, nowMs);
  const hasCurrentCreateAccess = useCallback(
    () => hasCurrentFullAccess(subscription),
    [subscription],
  );

  return {
    subscription,
    canCreateRecords,
    hasCurrentCreateAccess,
    message,
    refresh,
    isGuest: account.isGuest === true,
    trialDaysLeft: account.isGuest && guestState
      ? guestTrialStatus(guestState, nowMs || Date.now()).daysLeft
      : null,
  };
}

type EntitlementState = { accountId: string | undefined; subscription: SubscriptionEntitlement | null; message: string; nowMs: number; guestState: GuestTrialState | null };
const EMPTY_STATE: EntitlementState = { accountId: undefined, subscription: null, message: "Checking subscription access...", nowMs: 0, guestState: null };
let sharedState = EMPTY_STATE;
const listeners = new Set<() => void>();
function getSnapshot() { return sharedState; }
function subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
function publish(next: EntitlementState) { sharedState = next; listeners.forEach((listener) => listener()); }
