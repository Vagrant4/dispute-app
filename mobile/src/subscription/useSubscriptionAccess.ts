import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

import {
  fetchSubscriptionStatus,
  hasCurrentFullAccess,
  type SubscriptionEntitlement,
} from "./subscriptionClient";
import type { LocalAccount } from "../auth/localAuth";
import { buildGuestEntitlement, type GuestTrialState, guestTrialStatus, loadGuestTrial, observeClock, saveGuestTrial, startGuestTrial } from "./guestTrial";

export function useSubscriptionAccess(account: LocalAccount) {
  const [subscription, setSubscription] = useState<SubscriptionEntitlement | null>(null);
  const [message, setMessage] = useState("Checking subscription access...");
  const [nowMs, setNowMs] = useState(0);
  const [guestState, setGuestState] = useState<GuestTrialState | null>(null);

  const refresh = useCallback(async () => {
    if (account.isGuest) {
      const now = Date.now();
      const state = observeClock(startGuestTrial(now, await loadGuestTrial()), now);
      await saveGuestTrial(state);
      setGuestState(state);
      const entitlement = buildGuestEntitlement(state, now);
      setSubscription(entitlement);
      setMessage(entitlement.message);
      setNowMs(now);
      return;
    }
    const result = await fetchSubscriptionStatus(account.id);
    if (!result.ok) {
      setSubscription(null);
      setMessage(result.message);
      return;
    }
    setSubscription(result.subscription);
    setMessage(result.subscription.message);
    setNowMs(Date.now());
  }, [account.id]);

  useEffect(() => {
    const initialRefresh = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => {
      setNowMs(Date.now());
      if (account.isGuest) void refresh();
    }, 30_000);
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setNowMs(Date.now());
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
