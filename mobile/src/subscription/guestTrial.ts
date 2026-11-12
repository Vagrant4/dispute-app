import * as SecureStore from "expo-secure-store";
import type { SubscriptionEntitlement } from "./subscriptionClient";

export const GUEST_TRIAL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const KEY = "dispute.guest-trial.v1";

export type GuestTrialState = { firstUseAt: number; highWaterMs: number };
export type GuestTrialStorage = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
};

export function startGuestTrial(nowMs: number, existing?: GuestTrialState | null): GuestTrialState {
  return existing
    ? { firstUseAt: Math.min(existing.firstUseAt, nowMs), highWaterMs: Math.max(existing.highWaterMs, nowMs) }
    : { firstUseAt: nowMs, highWaterMs: nowMs };
}

export function observeClock(state: GuestTrialState, nowMs: number): GuestTrialState {
  return { ...state, highWaterMs: Math.max(state.highWaterMs, nowMs) };
}

export function effectiveNowMs(state: GuestTrialState, nowMs: number): number {
  return Math.max(nowMs, state.highWaterMs, state.firstUseAt);
}

export function guestTrialStatus(state: GuestTrialState, nowMs: number) {
  const trialEndsAt = state.firstUseAt + GUEST_TRIAL_DAYS * DAY_MS;
  const effectiveNow = effectiveNowMs(state, nowMs);
  return {
    daysUsed: Math.min(GUEST_TRIAL_DAYS, Math.floor(Math.max(0, effectiveNow - state.firstUseAt) / DAY_MS) + 1),
    daysLeft: Math.max(0, Math.ceil((trialEndsAt - effectiveNow) / DAY_MS)),
    expired: effectiveNow >= trialEndsAt,
    trialEndsAt,
  };
}

export function buildGuestEntitlement(state: GuestTrialState, nowMs: number): SubscriptionEntitlement {
  const status = guestTrialStatus(state, nowMs);
  const active = !status.expired;
  return {
    userId: "local-user", status: active ? "TRIALING" : "EXPIRED", isActive: active,
    canCreateRecords: active, canExportReports: active, canExportPremiumReports: active,
    canExportBasicData: true, billingProvider: "store", billingEnforcementActive: true,
    planName: "DISPUTE Basic", priceCents: 699, currency: "SGD", billingInterval: "month",
    hasReferralRewardAccess: false, referralRewardEndsAt: null,
    trialEndsAt: new Date(status.trialEndsAt).toISOString(), currentPeriodEnd: null,
    message: active ? `Free trial · ${status.daysLeft} day${status.daysLeft === 1 ? "" : "s"} left` : "Trial ended. Existing records remain viewable.",
  };
}

export async function loadGuestTrial(storage: GuestTrialStorage = SecureStore): Promise<GuestTrialState | null> {
  try {
    const raw = await storage.getItemAsync(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as GuestTrialState;
    return Number.isFinite(value.firstUseAt) && Number.isFinite(value.highWaterMs) ? value : null;
  } catch { return null; }
}

export async function saveGuestTrial(state: GuestTrialState, storage: GuestTrialStorage = SecureStore): Promise<void> {
  await storage.setItemAsync(KEY, JSON.stringify(state));
}

export async function rewriteGuestTrial(firstUseAt: number, nowMs = Date.now()): Promise<GuestTrialState> {
  const state = { firstUseAt, highWaterMs: nowMs };
  await saveGuestTrial(state);
  return state;
}

export const isTrialDebugOverrideEnabled = () =>
  typeof __DEV__ !== "undefined" && __DEV__ && process.env.EXPO_PUBLIC_TRIAL_DEBUG_OVERRIDE === "1";
