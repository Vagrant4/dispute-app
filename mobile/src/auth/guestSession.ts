import * as SecureStore from "expo-secure-store";

const GUEST_SESSION_KEY = "dispute.guest-session-active.v1";

export async function isGuestSessionActive(): Promise<boolean> {
  return (await SecureStore.getItemAsync(GUEST_SESSION_KEY)) === "1";
}

export async function setGuestSessionActive(active: boolean): Promise<void> {
  if (active) await SecureStore.setItemAsync(GUEST_SESSION_KEY, "1");
  else await SecureStore.deleteItemAsync(GUEST_SESSION_KEY);
}
