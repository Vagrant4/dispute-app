import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";

import { type LocalAccount, type LocalAccountStorage } from "./localAuth";

const AUTH_DIRECTORY = `${FileSystem.documentDirectory ?? ""}auth`;
const AUTH_FILE = `${AUTH_DIRECTORY}/local-accounts.json`;
const LEGACY_SAVED_LOGIN_FILE = `${AUTH_DIRECTORY}/saved-login.json`;
const SAVED_LOGIN_KEY = "dispute.saved-login.v1";

export type SavedLoginDetails = {
  email: string;
  password: string;
};

async function ensureAuthDirectory() {
  const directoryInfo = await FileSystem.getInfoAsync(AUTH_DIRECTORY);
  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(AUTH_DIRECTORY, { intermediates: true });
  }
}

export const phoneLocalAccountStorage: LocalAccountStorage = {
  async loadAccounts() {
    const fileInfo = await FileSystem.getInfoAsync(AUTH_FILE);
    if (!fileInfo.exists) {
      return [];
    }

    const content = await FileSystem.readAsStringAsync(AUTH_FILE, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const parsed = JSON.parse(content) as unknown;
    const accounts = sanitizeAccounts(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(accounts)) {
      await saveLocalAccounts(accounts);
    }
    return accounts;
  },
  async saveAccounts(accounts) {
    await saveLocalAccounts(accounts);
  },
};

async function saveLocalAccounts(accounts: LocalAccount[]): Promise<void> {
  await ensureAuthDirectory();
  await FileSystem.writeAsStringAsync(
    AUTH_FILE,
    JSON.stringify(sanitizeAccounts(accounts)),
    { encoding: FileSystem.EncodingType.UTF8 },
  );
}

export async function loadSavedLoginDetails(): Promise<SavedLoginDetails | null> {
  const secureValue = await SecureStore.getItemAsync(SAVED_LOGIN_KEY);
  const secureDetails = parseSavedLogin(secureValue);
  if (secureDetails) {
    return secureDetails;
  }

  const legacyDetails = await loadLegacySavedLoginDetails();
  if (!legacyDetails) {
    return null;
  }

  await SecureStore.setItemAsync(SAVED_LOGIN_KEY, JSON.stringify(legacyDetails));
  await FileSystem.deleteAsync(LEGACY_SAVED_LOGIN_FILE, { idempotent: true });
  return legacyDetails;
}

export async function saveSavedLoginDetails(details: SavedLoginDetails): Promise<void> {
  await SecureStore.setItemAsync(SAVED_LOGIN_KEY, JSON.stringify(details));
  await FileSystem.deleteAsync(LEGACY_SAVED_LOGIN_FILE, { idempotent: true });
}

export async function clearSavedLoginDetails(): Promise<void> {
  await SecureStore.deleteItemAsync(SAVED_LOGIN_KEY);
  await FileSystem.deleteAsync(LEGACY_SAVED_LOGIN_FILE, { idempotent: true });
}

async function loadLegacySavedLoginDetails(): Promise<SavedLoginDetails | null> {
  const fileInfo = await FileSystem.getInfoAsync(LEGACY_SAVED_LOGIN_FILE);
  if (!fileInfo.exists) {
    return null;
  }
  const content = await FileSystem.readAsStringAsync(LEGACY_SAVED_LOGIN_FILE, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return parseSavedLogin(content);
}

function parseSavedLogin(content: string | null): SavedLoginDetails | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as Partial<SavedLoginDetails>;
    if (typeof parsed.email !== "string" || typeof parsed.password !== "string") {
      return null;
    }
    return { email: parsed.email, password: parsed.password };
  } catch {
    return null;
  }
}

function sanitizeAccounts(value: unknown): LocalAccount[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const account = entry as Partial<LocalAccount>;
    if (typeof account.email !== "string" || typeof account.name !== "string") return [];
    return [{
      ...(typeof account.id === "string" ? { id: account.id } : {}),
      email: account.email.trim().toLowerCase(),
      name: account.name,
      phone: typeof account.phone === "string" ? account.phone : "",
      emailVerified: account.emailVerified === true,
    }];
  });
}
