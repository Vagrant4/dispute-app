export type AccountDeletionDatabase = {
  execAsync(sql: string): Promise<unknown>;
};

export type AccountDeletionFileSystem = {
  deleteAsync(path: string, options: { idempotent: boolean }): Promise<unknown>;
};

export const DELETE_LOCAL_ACCOUNT_DATA_SQL = `
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE TRANSACTION;
DELETE FROM photo_evidence;
DELETE FROM generated_documents;
DELETE FROM time_entries;
DELETE FROM projects;
DELETE FROM clients;
DELETE FROM subscription_entitlements;
DELETE FROM app_settings;
COMMIT;
`;

export async function clearLocalAccountData(input: {
  database: AccountDeletionDatabase;
  fileSystem: AccountDeletionFileSystem;
  directories: string[];
  clearAuthData: () => Promise<void>;
}): Promise<void> {
  await input.database.execAsync(DELETE_LOCAL_ACCOUNT_DATA_SQL);
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
