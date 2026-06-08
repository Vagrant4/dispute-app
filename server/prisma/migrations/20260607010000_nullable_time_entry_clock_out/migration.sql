PRAGMA foreign_keys=OFF;

CREATE TABLE "new_TimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "clockInTime" DATETIME NOT NULL,
    "clockOutTime" DATETIME,
    "breakMinutes" INTEGER NOT NULL,
    "totalHours" REAL NOT NULL,
    "overtimeHours" REAL NOT NULL,
    "workDescription" TEXT NOT NULL,
    "manualEntryFlag" BOOLEAN NOT NULL DEFAULT false,
    "locationText" TEXT NOT NULL,
    "clockInGpsLat" REAL,
    "clockInGpsLng" REAL,
    "clockOutGpsLat" REAL,
    "clockOutGpsLng" REAL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_projectId_userId_fkey" FOREIGN KEY ("projectId", "userId") REFERENCES "Project" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_TimeEntry" (
    "id",
    "userId",
    "projectId",
    "date",
    "clockInTime",
    "clockOutTime",
    "breakMinutes",
    "totalHours",
    "overtimeHours",
    "workDescription",
    "manualEntryFlag",
    "locationText",
    "clockInGpsLat",
    "clockInGpsLng",
    "clockOutGpsLat",
    "clockOutGpsLng",
    "status",
    "notes",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "userId",
    "projectId",
    "date",
    "clockInTime",
    "clockOutTime",
    "breakMinutes",
    "totalHours",
    "overtimeHours",
    "workDescription",
    "manualEntryFlag",
    "locationText",
    "clockInGpsLat",
    "clockInGpsLng",
    "clockOutGpsLat",
    "clockOutGpsLng",
    "status",
    "notes",
    "createdAt",
    "updatedAt"
FROM "TimeEntry";

DROP TABLE "TimeEntry";
ALTER TABLE "new_TimeEntry" RENAME TO "TimeEntry";

CREATE INDEX "TimeEntry_userId_idx" ON "TimeEntry"("userId");
CREATE INDEX "TimeEntry_projectId_idx" ON "TimeEntry"("projectId");
CREATE UNIQUE INDEX "TimeEntry_id_userId_key" ON "TimeEntry"("id", "userId");
CREATE UNIQUE INDEX "TimeEntry_id_projectId_userId_key" ON "TimeEntry"("id", "projectId", "userId");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
