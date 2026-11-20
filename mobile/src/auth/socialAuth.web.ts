import { type SocialProvider } from "./remoteAuth";

// The production sign-in buttons use native providers. Web export is retained for
// review previews and does not attempt to load native Google/Apple modules.
export function socialAuthConfigurationMessage(_provider: SocialProvider): string | null {
  return "Social sign-in is available in the installed DISPUTE app.";
}

export async function signInWithGoogle() {
  return { ok: false as const, message: socialAuthConfigurationMessage("google")! };
}

export async function signInWithApple() {
  return { ok: false as const, message: socialAuthConfigurationMessage("apple")! };
}
