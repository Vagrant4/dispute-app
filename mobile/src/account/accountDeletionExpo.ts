import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";

import { clearAllLocalAuthData } from "../auth/localAuthStorageExpo";
import { openAndInitializeLocalDatabase } from "../db/localDatabase";
import { resetLocalRepositoriesForTest } from "../db/repositories";
import { clearLocalAccountData } from "./accountDeletionCore";

const PENDING_ACCOUNT_DELETION_KEY = "dispute.pending-account-deletion.v1";

export async function markAccountDeletionPending(requestId: string): Promise<void> {
  await SecureStore.setItemAsync(
    PENDING_ACCOUNT_DELETION_KEY,
    JSON.stringify({ requestId, stage: "prepared" }),
  );
}

export async function markServerAccountDeleted(requestId: string): Promise<void> {
  await SecureStore.setItemAsync(
    PENDING_ACCOUNT_DELETION_KEY,
    JSON.stringify({ requestId, stage: "server-deleted" }),
  );
}

export async function cancelPendingAccountDeletion(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_ACCOUNT_DELETION_KEY);
}

export async function clearDeletedAccountLocalData(): Promise<void> {
  const database = await openAndInitializeLocalDatabase();
  const base = FileSystem.documentDirectory;
  const directories = base
    ? [
        `${base}evidence-photos`,
        `${base}generated-documents`,
        `${base}backups`,
      ]
    : [];

  await clearLocalAccountData({
    database,
    fileSystem: FileSystem,
    directories,
    clearAuthData: clearAllLocalAuthData,
  });
  resetLocalRepositoriesForTest();
  await SecureStore.deleteItemAsync(PENDING_ACCOUNT_DELETION_KEY);
}

export async function resumeCompletedAccountDeletionCleanup(): Promise<boolean> {
  const marker = await SecureStore.getItemAsync(PENDING_ACCOUNT_DELETION_KEY);
  if (!marker) return false;
  try {
    const parsed = JSON.parse(marker) as { stage?: unknown };
    if (parsed.stage !== "server-deleted") return false;
    await clearDeletedAccountLocalData();
    return true;
  } catch {
    return false;
  }
}
