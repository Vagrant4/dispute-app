-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'WORKER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uen" TEXT,
    "contactPerson" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Company_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "projectName" TEXT NOT NULL,
    "siteAddress" TEXT NOT NULL,
    "poOrWorkOrderNumber" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "description" TEXT NOT NULL,
    "defaultHourlyRate" DECIMAL,
    "defaultDailyRate" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Project_companyId_userId_fkey" FOREIGN KEY ("companyId", "userId") REFERENCES "Company" ("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimeEntry" (
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

-- CreateTable
CREATE TABLE "PhotoEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "timeEntryId" TEXT,
    "imagePath" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "gpsLat" REAL,
    "gpsLng" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PhotoEvidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhotoEvidence_projectId_userId_fkey" FOREIGN KEY ("projectId", "userId") REFERENCES "Project" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhotoEvidence_timeEntryId_projectId_userId_fkey" FOREIGN KEY ("timeEntryId", "projectId", "userId") REFERENCES "TimeEntry" ("id", "projectId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaySummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "salaryPeriodStart" DATETIME NOT NULL,
    "salaryPeriodEnd" DATETIME NOT NULL,
    "rateType" TEXT NOT NULL,
    "basicRate" DECIMAL NOT NULL,
    "basicPay" DECIMAL NOT NULL,
    "overtimeRate" DECIMAL NOT NULL,
    "overtimePay" DECIMAL NOT NULL,
    "restDayPay" DECIMAL NOT NULL,
    "publicHolidayPay" DECIMAL NOT NULL,
    "totalAllowances" DECIMAL NOT NULL,
    "totalDeductions" DECIMAL NOT NULL,
    "grossPay" DECIMAL NOT NULL,
    "netPay" DECIMAL NOT NULL,
    "itemisedPayslipJson" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaySummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaySummary_projectId_userId_fkey" FOREIGN KEY ("projectId", "userId") REFERENCES "Project" ("id", "userId") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Allowance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paySummaryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    CONSTRAINT "Allowance_paySummaryId_fkey" FOREIGN KEY ("paySummaryId") REFERENCES "PaySummary" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Deduction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paySummaryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    CONSTRAINT "Deduction_paySummaryId_fkey" FOREIGN KEY ("paySummaryId") REFERENCES "PaySummary" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProgressClaimReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "companySnapshotJson" TEXT NOT NULL,
    "workerSnapshotJson" TEXT NOT NULL,
    "projectSnapshotJson" TEXT NOT NULL,
    "claimPeriodStart" DATETIME NOT NULL,
    "claimPeriodEnd" DATETIME NOT NULL,
    "totalDaysWorked" INTEGER NOT NULL,
    "totalHours" REAL NOT NULL,
    "totalOvertimeHours" REAL NOT NULL,
    "totalClaimAmount" DECIMAL NOT NULL,
    "entriesSnapshotJson" TEXT NOT NULL,
    "photosSnapshotJson" TEXT NOT NULL,
    "pdfPath" TEXT NOT NULL,
    "csvPath" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProgressClaimReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgressClaimReport_projectId_userId_fkey" FOREIGN KEY ("projectId", "userId") REFERENCES "Project" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "standardDailyHours" REAL NOT NULL DEFAULT 8,
    "standardWeeklyHours" REAL NOT NULL DEFAULT 44,
    "overtimeMultiplier" REAL NOT NULL DEFAULT 1.5,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'SGD',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AppSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "price" DECIMAL NOT NULL,
    "limitsJson" TEXT NOT NULL,
    "status" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerProfile_userId_key" ON "WorkerProfile"("userId");

-- CreateIndex
CREATE INDEX "Company_userId_idx" ON "Company"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_id_userId_key" ON "Company"("id", "userId");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "Project_companyId_idx" ON "Project"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_id_userId_key" ON "Project"("id", "userId");

-- CreateIndex
CREATE INDEX "TimeEntry_userId_idx" ON "TimeEntry"("userId");

-- CreateIndex
CREATE INDEX "TimeEntry_projectId_idx" ON "TimeEntry"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeEntry_id_userId_key" ON "TimeEntry"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeEntry_id_projectId_userId_key" ON "TimeEntry"("id", "projectId", "userId");

-- CreateIndex
CREATE INDEX "PhotoEvidence_userId_idx" ON "PhotoEvidence"("userId");

-- CreateIndex
CREATE INDEX "PhotoEvidence_projectId_idx" ON "PhotoEvidence"("projectId");

-- CreateIndex
CREATE INDEX "PhotoEvidence_timeEntryId_idx" ON "PhotoEvidence"("timeEntryId");

-- CreateIndex
CREATE INDEX "PaySummary_userId_idx" ON "PaySummary"("userId");

-- CreateIndex
CREATE INDEX "PaySummary_projectId_idx" ON "PaySummary"("projectId");

-- CreateIndex
CREATE INDEX "Allowance_paySummaryId_idx" ON "Allowance"("paySummaryId");

-- CreateIndex
CREATE INDEX "Deduction_paySummaryId_idx" ON "Deduction"("paySummaryId");

-- CreateIndex
CREATE INDEX "ProgressClaimReport_userId_idx" ON "ProgressClaimReport"("userId");

-- CreateIndex
CREATE INDEX "ProgressClaimReport_projectId_idx" ON "ProgressClaimReport"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_userId_key" ON "AppSetting"("userId");

