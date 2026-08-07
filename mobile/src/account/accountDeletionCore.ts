import type { LocalDatabase } from "../db/localDatabase";

export type AccountDeletionDatabase = Pick<LocalDatabase, "execAsync" | "runAsync">;
export type AccountDeletionFileDatabase = Pick<LocalDatabase, "getAllAsync">;

export type AccountDeletionFileSystem = {
  deleteAsync(path: string, options: { idempotent: boolean }): Promise<unknown>;
};

export const DELETE_LOCAL_ACCOUNT_DATA_SQL = [
  "DELETE FROM photo_evidence WHERE user_id = ?",
  "DELETE FROM generated_documents WHERE user_id = ?",
  "DELETE FROM time_entries WHERE user_id = ?",
  "DELETE FROM projects WHERE user_id = ?",
  "DELETE FROM clients WHERE user_id = ?",
  "DELETE FROM subscription_entitlements WHERE user_id = ?",
  "DELETE FROM app_settings WHERE user_id = ?",
] as const;

export async function listOwnedLocalFileUris(
  database: AccountDeletionFileDatabase,
  userId: string,
  documentDirectory: string | null | undefined,
): Promise<string[]> {
  const [photos, reports] = await Promise.all([
    database.getAllAsync<{ local_uri: string | null }>(
      "SELECT local_uri FROM photo_evidence WHERE user_id = ?",
      [userId],
    ),
    database.getAllAsync<{ local_uri: string | null }>(
      "SELECT local_uri FROM generated_documents WHERE user_id = ?",
      [userId],
    ),
  ]);
  return [...photos, ...reports].flatMap((row) => {
    const uri = row.local_uri;
    return typeof uri === "string" &&
      isOwnedAppFileUri(uri, userId, documentDirectory)
      ? [uri]
      : [];
  });
}

function isOwnedAppFileUri(
  uri: string,
  userId: string,
  documentDirectory: string | null | undefined,
): boolean {
  if (!documentDirectory || /%(?:2f|5c)/i.test(uri)) {
    return false;
  }
  let normalized: string;
  let normalizedRoot: string;
  try {
    normalized = decodeURIComponent(uri).replaceAll("\\", "/");
    normalizedRoot = decodeURIComponent(documentDirectory).replaceAll("\\", "/");
  } catch {
    return false;
  }
  if (
    !normalized.startsWith("file://") ||
    !normalizedRoot.startsWith("file://") ||
    /%(?:2e|2f|5c)/i.test(normalized) ||
    normalized.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    return false;
  }
  const root = normalizedRoot.endsWith("/") ? normalizedRoot : `${normalizedRoot}/`;
  const ownerSegments = [sanitizePathSegment(userId), "local-user"];
  return ownerSegments.some(
    (owner) =>
      normalized.startsWith(`${root}evidence-photos/${owner}/`) ||
      normalized.startsWith(`${root}generated-documents/${owner}/`) ||
      normalized.startsWith(`${root}backups/${owner}/`),
  );
}

function sanitizePathSegment(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return sanitized || "unknown";
}

export async function clearLocalAccountData(input: {
  database: AccountDeletionDatabase;
  userId: string;
  fileSystem: AccountDeletionFileSystem;
  directories: string[];
  clearAuthData: () => Promise<void>;
}): Promise<void> {
  await input.database.execAsync("BEGIN IMMEDIATE TRANSACTION;");
  try {
    for (const sql of DELETE_LOCAL_ACCOUNT_DATA_SQL) {
      await input.database.runAsync(sql, [input.userId]);
    }
    await input.database.execAsync("COMMIT;");
  } catch (error) {
    await input.database.execAsync("ROLLBACK;");
    throw error;
  }
  const results = await Promise.allSettled([
    ...input.directories.map((directory) =>
      input.fileSystem.deleteAsync(directory, { idempotent: true }),
    ),
    input.clearAuthData(),
  ]);
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failure) {
    throw failure.reason instanceof Error
      ? failure.reason
      : new Error("Local account data cleanup failed.");
  }
}
