import { type LocalAccount, type LocalAccountStorage } from "./localAuth";

export type PendingEmailVerification = {
  email: string;
  name: string;
  phone: string;
  message: string;
  devVerificationCode?: string;
};

export type RemoteAuthResult =
  | { ok: true; account: LocalAccount; message: string }
  | { ok: false; message: string };

export type RemoteRegistrationResult =
  | { ok: true; pending: PendingEmailVerification }
  | { ok: false; message: string };

export type RemotePasswordResetRequestResult =
  | { ok: true; email: string; message: string; devResetCode?: string }
  | { ok: false; message: string };

type FetchLike = typeof fetch;

const expoEnv = (globalThis as unknown as {
  process?: { env?: Record<string, string | undefined> };
}).process?.env;

const apiBaseUrl =
  expoEnv?.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "https://dispute-api-live.onrender.com";

export function getAuthApiBaseUrl() {
  return apiBaseUrl;
}

export async function registerRemoteAccount(
  input: {
    email: string;
    name: string;
    phone: string;
    password: string;
    confirmPassword: string;
  },
  fetcher: FetchLike = fetch,
): Promise<RemoteRegistrationResult> {
  const localValidation = validateRegistrationInput(input);
  if (!localValidation.ok) {
    return localValidation;
  }

  try {
    const response = await fetcher(`${apiBaseUrl}/auth/register`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email.trim().toLowerCase(),
        password: input.password,
        fullName: input.name.trim(),
        phone: input.phone.trim(),
      }),
    });
    const body = await readJsonBody(response);

    if (!response.ok) {
      return { ok: false, message: getErrorMessage(body, "Unable to create account.") };
    }

    return {
      ok: true,
      pending: {
        email: input.email.trim().toLowerCase(),
        name: input.name.trim(),
        phone: input.phone.trim(),
        message:
          getString(body, "message") ??
          "Verification email sent. Enter the 6-digit code from Gmail.",
        devVerificationCode: getString(body, "devVerificationCode") ?? undefined,
      },
    };
  } catch {
    return {
      ok: false,
      message: "Unable to reach Dispute server. Check internet connection and try again.",
    };
  }
}

export async function requestRemoteEmailVerification(
  input: {
    email: string;
    name?: string;
    phone?: string;
  },
  fetcher: FetchLike = fetch,
): Promise<RemoteRegistrationResult> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  try {
    const response = await fetcher(`${apiBaseUrl}/auth/resend-verification`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
      }),
    });
    const body = await readJsonBody(response);

    if (!response.ok) {
      return {
        ok: false,
        message: getErrorMessage(body, "Unable to send verification code."),
      };
    }

    return {
      ok: true,
      pending: {
        email,
        name: input.name?.trim() || email.split("@")[0] || "Dispute user",
        phone: input.phone?.trim() ?? "",
        message:
          getString(body, "message") ??
          "A new verification code was sent to your email.",
        devVerificationCode: getString(body, "devVerificationCode") ?? undefined,
      },
    };
  } catch {
    return {
      ok: false,
      message: "Unable to reach Dispute server. Check internet connection and try again.",
    };
  }
}

export async function verifyRemoteEmail(
  pending: PendingEmailVerification,
  code: string,
  storage?: LocalAccountStorage,
  fetcher: FetchLike = fetch,
): Promise<RemoteAuthResult> {
  const verificationCode = code.trim();
  if (!/^\d{6}$/.test(verificationCode)) {
    return { ok: false, message: "Enter the 6-digit verification code from Gmail." };
  }

  try {
    const response = await fetcher(`${apiBaseUrl}/auth/verify-email`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: pending.email,
        code: verificationCode,
      }),
    });
    const body = await readJsonBody(response);

    if (!response.ok) {
      return { ok: false, message: getErrorMessage(body, "Verification failed.") };
    }

    const account: LocalAccount = {
      id: getNestedString(body, ["user", "id"]) ?? pending.email,
      email: pending.email,
      name: getNestedString(body, ["profile", "fullName"]) ?? pending.name,
      phone: getNestedString(body, ["profile", "phone"]) ?? pending.phone,
      emailVerified: true,
    };

    if (storage) {
      await saveVerifiedAccount(account, storage);
    }

    return {
      ok: true,
      account,
      message: getString(body, "message") ?? "Email verified. You are logged in.",
    };
  } catch {
    return {
      ok: false,
      message: "Unable to verify with Dispute server. Check internet connection and try again.",
    };
  }
}

export async function resendRemoteVerificationCode(
  pending: PendingEmailVerification,
  fetcher: FetchLike = fetch,
): Promise<RemoteRegistrationResult> {
  return requestRemoteEmailVerification(
    {
      name: pending.name,
      email: pending.email,
      phone: pending.phone,
    },
    fetcher,
  );
}

export async function loginRemoteAccount(
  input: { email: string; password: string },
  fetcher: FetchLike = fetch,
): Promise<RemoteAuthResult> {
  try {
    const response = await fetcher(`${apiBaseUrl}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email.trim().toLowerCase(),
        password: input.password,
      }),
    });
    const body = await readJsonBody(response);

    if (!response.ok) {
      return { ok: false, message: getErrorMessage(body, "Login failed.") };
    }

    return {
      ok: true,
      account: {
        id: getNestedString(body, ["user", "id"]) ?? input.email,
        email: input.email.trim().toLowerCase(),
        name:
          getNestedString(body, ["profile", "fullName"]) ??
          getNestedString(body, ["user", "email"])?.split("@")[0] ??
          "Dispute user",
        phone: getNestedString(body, ["profile", "phone"]) ?? "",
        emailVerified: true,
      },
      message: "Login successful.",
    };
  } catch {
    return {
      ok: false,
      message: "Unable to reach Dispute server. Check internet connection and try again.",
    };
  }
}

export async function requestRemotePasswordReset(
  input: { email: string },
  fetcher: FetchLike = fetch,
): Promise<RemotePasswordResetRequestResult> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Enter your registered email address." };
  }

  try {
    const response = await fetcher(`${apiBaseUrl}/auth/forgot-password`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = await readJsonBody(response);

    if (!response.ok) {
      return { ok: false, message: getErrorMessage(body, "Unable to send reset code.") };
    }

    return {
      ok: true,
      email,
      message:
        getString(body, "message") ??
        "Check your email for the 6-digit password reset code.",
      devResetCode: getString(body, "devResetCode") ?? undefined,
    };
  } catch {
    return {
      ok: false,
      message: "Unable to reach Dispute server. Check internet connection and try again.",
    };
  }
}

export async function resetRemotePassword(
  input: {
    email: string;
    code: string;
    password: string;
    confirmPassword: string;
  },
  fetcher: FetchLike = fetch,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const email = input.email.trim().toLowerCase();
  const code = input.code.trim();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, message: "Enter the 6-digit password reset code." };
  }
  if (input.password.length < 8) {
    return { ok: false, message: "Use at least 8 characters for the new password." };
  }
  if (input.password !== input.confirmPassword) {
    return { ok: false, message: "Passwords do not match." };
  }

  try {
    const response = await fetcher(`${apiBaseUrl}/auth/reset-password`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        code,
        password: input.password,
      }),
    });
    const body = await readJsonBody(response);

    if (!response.ok) {
      return { ok: false, message: getErrorMessage(body, "Unable to reset password.") };
    }

    return {
      ok: true,
      message:
        getString(body, "message") ??
        "Password reset successful. You can login with your new password.",
    };
  } catch {
    return {
      ok: false,
      message: "Unable to reach Dispute server. Check internet connection and try again.",
    };
  }
}

async function saveVerifiedAccount(account: LocalAccount, storage: LocalAccountStorage) {
  const accounts = await storage.loadAccounts();
  const withoutDuplicate = accounts.filter(
    (stored) => stored.email.toLowerCase() !== account.email.toLowerCase(),
  );
  await storage.saveAccounts([...withoutDuplicate, account]);
}

async function readJsonBody(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function validateRegistrationInput(input: {
  email: string;
  name: string;
  phone: string;
  password: string;
  confirmPassword: string;
}): RemoteRegistrationResult {
  if (!input.name.trim()) {
    return { ok: false, message: "Enter your full name." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (!input.phone.trim()) {
    return { ok: false, message: "Enter your mobile number." };
  }
  if (input.password.length < 8) {
    return { ok: false, message: "Use at least 8 characters for the password." };
  }
  if (input.password !== input.confirmPassword) {
    return { ok: false, message: "Passwords do not match." };
  }
  return { ok: true, pending: {} as PendingEmailVerification };
}

function getErrorMessage(body: Record<string, unknown>, fallback: string) {
  return getString(body, "error") ?? getString(body, "message") ?? fallback;
}

function getString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "string" ? value : null;
}

function getNestedString(body: Record<string, unknown>, path: string[]) {
  let cursor: unknown = body;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object") {
      return null;
    }
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return typeof cursor === "string" ? cursor : null;
}
