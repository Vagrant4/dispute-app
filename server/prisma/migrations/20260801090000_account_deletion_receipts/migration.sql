CREATE TABLE "AccountDeletionReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storageCleanupComplete" BOOLEAN NOT NULL DEFAULT false
);
