import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import { Platform } from "react-native";

import { loginWithSocialIdentity, startAppleAuthRelay, type SocialProvider } from "./remoteAuth";

const expoEnv = (globalThis as unknown as {
  process?: { env?: Record<string, string | undefined> };
}).process?.env;

const googleIosClientId = expoEnv?.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? "";
const googleAndroidClientId = expoEnv?.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() ?? "";
const googleWebClientId = expoEnv?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? "";
const appleServicesId = expoEnv?.EXPO_PUBLIC_APPLE_SERVICES_ID?.trim() ?? "";
const appleRedirectUri = expoEnv?.EXPO_PUBLIC_APPLE_REDIRECT_URI?.trim() ?? "";

export function socialAuthConfigurationMessage(provider: SocialProvider): string | null {
  if (provider === "google") {
    if (!googleWebClientId) return "Google sign-in is not configured yet.";
    if (Platform.OS === "ios" && !googleIosClientId) return "Google sign-in is not configured for iPhone yet.";
    if (Platform.OS === "android" && !googleAndroidClientId) return "Google sign-in is not configured for Android yet.";
    return null;
  }
  if (Platform.OS === "android" && (!appleServicesId || !appleRedirectUri)) {
    return "Apple sign-in is not configured for Android yet.";
  }
  return null;
}

export async function signInWithGoogle() {
  const configurationMessage = socialAuthConfigurationMessage("google");
  if (configurationMessage) return { ok: false as const, message: configurationMessage };

  try {
    GoogleSignin.configure({
      webClientId: googleWebClientId,
      ...(googleIosClientId ? { iosClientId: googleIosClientId } : {}),
    });
    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const result = await GoogleSignin.signIn();
    if (result.type === "cancelled") return { ok: false as const, message: "Google sign-in was cancelled." };
    const idToken = result.data.idToken;
    if (!idToken) return { ok: false as const, message: "Google did not return a sign-in token. Please try again." };
    return loginWithSocialIdentity({
      provider: "google",
      idToken,
      fullName: result.data.user.name ?? undefined,
    });
  } catch {
    return { ok: false as const, message: "Unable to continue with Google. Please try again." };
  }
}

export async function signInWithApple() {
  const configurationMessage = socialAuthConfigurationMessage("apple");
  if (configurationMessage) return { ok: false as const, message: configurationMessage };

  try {
    if (Platform.OS === "ios" && await AppleAuthentication.isAvailableAsync()) {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) return { ok: false as const, message: "Apple did not return a sign-in token. Please try again." };
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(" ");
      return loginWithSocialIdentity({ provider: "apple", idToken: credential.identityToken, fullName: fullName || undefined });
    }

    const relay = await startAppleAuthRelay();
    if (!relay.ok) return relay;
    const redirectUri = appleRedirectUri;
    const request = await AuthSession.loadAsync({
      clientId: appleServicesId,
      redirectUri,
      responseType: AuthSession.ResponseType.IdToken,
      scopes: ["name", "email"],
      usePKCE: false,
      state: relay.state,
      extraParams: { response_mode: "form_post", nonce: relay.nonce },
    }, "https://appleid.apple.com");
    const result = await request.promptAsync({ authorizationEndpoint: "https://appleid.apple.com/auth/authorize" });
    const relayResult = result.type === "success" ? result.params.result : undefined;
    if (result.type === "success" && result.params.state !== relay.state) {
      return { ok: false as const, message: "Apple sign-in response did not match this request. Please try again." };
    }
    if (!relayResult) return { ok: false as const, message: result.type === "cancel" ? "Apple sign-in was cancelled." : "Apple sign-in did not complete. Please try again." };
    return loginWithSocialIdentity({ provider: "apple", appleRelayResult: relayResult });
  } catch {
    return { ok: false as const, message: "Unable to continue with Apple. Please try again." };
  }
}
