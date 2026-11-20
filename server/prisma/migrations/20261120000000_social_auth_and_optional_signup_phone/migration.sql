PRAGMA foreign_keys=OFF;

CREATE TABLE "new_WorkerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "normalizedPhone" TEXT,
    "workerIdentifier" TEXT,
    "finNric" TEXT,
    "trade" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL,
    "defaultHourlyRate" DECIMAL,
    "defaultDailyRate" DECIMAL,
    "defaultMonthlySalary" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WorkerProfile" ("id", "userId", "fullName", "phone", "normalizedPhone", "workerIdentifier", "finNric", "trade", "employmentType", "defaultHourlyRate", "defaultDailyRate", "defaultMonthlySalary", "createdAt", "updatedAt")
SELECT "id", "userId", "fullName", "phone", "normalizedPhone", "workerIdentifier", "finNric", "trade", "employmentType", "defaultHourlyRate", "defaultDailyRate", "defaultMonthlySalary", "createdAt", "updatedAt" FROM "WorkerProfile";
DROP TABLE "WorkerProfile";
ALTER TABLE "new_WorkerProfile" RENAME TO "WorkerProfile";
CREATE UNIQUE INDEX "WorkerProfile_userId_key" ON "WorkerProfile"("userId");
CREATE INDEX "WorkerProfile_normalizedPhone_idx" ON "WorkerProfile"("normalizedPhone");

CREATE TABLE "AuthIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "providerEmail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AuthIdentity_provider_providerUserId_key" ON "AuthIdentity"("provider", "providerUserId");
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

PRAGMA foreign_keys=ON;
