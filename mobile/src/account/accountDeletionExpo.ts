import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";

import { clearAllLocalAuthData } from "../auth/localAuthStorageExpo";
import { getRemoteAccountDeletionStatus } from "../auth/remoteAuth";
import { openAndInitializeLocalDatabase } from "../db/localDatabase";
import { resetLocalRepositoriesForTest } from "../db/repositories";
import { clearLocalAccountData } from "./accountDeletionCore";

const PENDING_ACCOUNT_DELETION_KEY = "dispute.pending-account-deletion.v1";
const PENDING_STATUS_RETENTION_MS = 5 * 60 * 1000;
const STATUS_RETRY_DELAYS_MS = [0, 1_000, 3_000] as const;
export type PendingAccountDeletion = {
  requestId: string;
  stage: "prepared" | "server-deleted";
  createdAt: string;
};

export async function markAccountDeletionPending(requestId: string): Promise<string> {
  const existing = await getPendingAccountDeletion();
  if (existing) return existing.requestId;
  await SecureStore.setItemAsync(
    PENDING_ACCOUNT_DELETION_KEY,
    JSON.stringify({ requestId, stage: "prepared", createdAt: new Date().toISOString() }),
  );
  return requestId;
}

export async function markServerAccountDeleted(requestId: string): Promise<void> {
  const existing = await getPendingAccountDeletion();
  await SecureStore.setItemAsync(
    PENDING_ACCOUNT_DELETION_KEY,
    JSON.stringify({
      requestId,
      stage: "server-deleted",
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }),
  );
}

export async function cancelPendingAccountDeletion(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_ACCOUNT_DELETION_KEY);
}

export async function clearDeletedAccountLocalData(): Promise<void> {
  const database = await openAndInitializeLocalDatabase();
  const documentDirectory = FileSystem.documentDirectory;
  const directories = documentDirectory
    ? [
        `${documentDirectory}evidence-photos`,
        `${documentDirectory}generated-documents`,
        `${documentDirectory}backups`,
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

export async function reconcilePendingAccountDeletion(): Promise<boolean> {
  const pending = await getPendingAccountDeletion();
  if (!pending) return false;

  if (pending.stage === "prepared") {
    let deletionConfirmed = false;
    let confirmedRequestId = pending.requestId;
    for (const delayMs of STATUS_RETRY_DELAYS_MS) {
      if (delayMs > 0) await wait(delayMs);
      const status = await getRemoteAccountDeletionStatus(pending.requestId);
      if (!status.ok) return false;
      if (status.deleted) {
        deletionConfirmed = true;
        confirmedRequestId = status.requestId ?? pending.requestId;
        break;
      }
    }
    if (!deletionConfirmed) {
      const createdAt = Date.parse(pending.createdAt);
      if (Number.isFinite(createdAt) && Date.now() - createdAt >= PENDING_STATUS_RETENTION_MS) {
        await cancelPendingAccountDeletion();
      }
      return false;
    }
    await markServerAccountDeleted(confirmedRequestId);
  }

  try {
    await clearDeletedAccountLocalData();
    return true;
  } catch {
    return false;
  }
}

export async function getPendingAccountDeletion(): Promise<PendingAccountDeletion | null> {
  const marker = await SecureStore.getItemAsync(PENDING_ACCOUNT_DELETION_KEY);
  if (!marker) return null;
  try {
    const parsed = JSON.parse(marker) as Partial<PendingAccountDeletion>;
    if (
      typeof parsed.requestId !== "string" ||
      (parsed.stage !== "prepared" && parsed.stage !== "server-deleted") ||
      typeof parsed.createdAt !== "string"
    ) {
      return null;
    }
    return parsed as PendingAccountDeletion;
  } catch {
    return null;
  }
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
