import * as FileSystem from "expo-file-system/legacy";

import { type LocalAccount, type LocalAccountStorage } from "./localAuth";

const AUTH_DIRECTORY = `${FileSystem.documentDirectory ?? ""}auth`;
const AUTH_FILE = `${AUTH_DIRECTORY}/local-accounts.json`;
const SAVED_LOGIN_FILE = `${AUTH_DIRECTORY}/saved-login.json`;

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
    return JSON.parse(content) as LocalAccount[];
  },
  async saveAccounts(accounts) {
    await ensureAuthDirectory();
    await FileSystem.writeAsStringAsync(AUTH_FILE, JSON.stringify(accounts), {
      encoding: FileSystem.EncodingType.UTF8,
    });
  },
};

export async function loadSavedLoginDetails(): Promise<SavedLoginDetails | null> {
  const fileInfo = await FileSystem.getInfoAsync(SAVED_LOGIN_FILE);
  if (!fileInfo.exists) {
    return null;
  }

  const content = await FileSystem.readAsStringAsync(SAVED_LOGIN_FILE, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const parsed = JSON.parse(content) as Partial<SavedLoginDetails>;
  if (typeof parsed.email !== "string" || typeof parsed.password !== "string") {
    return null;
  }

  return {
    email: parsed.email,
    password: parsed.password,
  };
}

export async function saveSavedLoginDetails(details: SavedLoginDetails): Promise<void> {
  await ensureAuthDirectory();
  await FileSystem.writeAsStringAsync(SAVED_LOGIN_FILE, JSON.stringify(details), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function clearSavedLoginDetails(): Promise<void> {
  await FileSystem.deleteAsync(SAVED_LOGIN_FILE, { idempotent: true });
}
