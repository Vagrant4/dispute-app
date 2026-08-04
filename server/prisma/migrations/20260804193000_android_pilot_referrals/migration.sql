-- Add server-owned referral attribution, paid-period tracking and reward ledger.

ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "WorkerProfile" ADD COLUMN "normalizedPhone" TEXT;

UPDATE "User"
SET "referralCode" = 'LEGACY-' || replace("id", '-', '')
WHERE "referralCode" IS NULL;

CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
UPDATE "WorkerProfile"
SET "normalizedPhone" = '+' || replace(replace(replace(replace(replace("phone", ' ', ''), '-', ''), '(', ''), ')', ''), '+', '')
WHERE "phone" IS NOT NULL AND trim("phone") <> '';
UPDATE "WorkerProfile"
SET "normalizedPhone" = replace(replace(replace(replace("normalizedPhone", '.', ''), '/', ''), '\', ''), char(9), '')
WHERE "normalizedPhone" IS NOT NULL;
CREATE INDEX "WorkerProfile_normalizedPhone_idx" ON "WorkerProfile"("normalizedPhone");

CREATE TABLE "Referral" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "referrerUserId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "codeUsed" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidPeriodCount" INTEGER NOT NULL DEFAULT 0,
    "qualifiedAt" DATETIME,
    "rewardedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Referral_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Referral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Referral_referredUserId_key" ON "Referral"("referredUserId");
CREATE INDEX "Referral_referrerUserId_idx" ON "Referral"("referrerUserId");
CREATE INDEX "Referral_status_idx" ON "Referral"("status");

CREATE TABLE "ReferralReward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EARNED',
    "earnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" DATETIME,
    "fulfillmentStartsAt" DATETIME,
    "fulfillmentEndsAt" DATETIME,
    "fulfillmentRef" TEXT,
    CONSTRAINT "ReferralReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReferralReward_userId_ordinal_key" ON "ReferralReward"("userId", "ordinal");
CREATE INDEX "ReferralReward_status_idx" ON "ReferralReward"("status");

CREATE TABLE "SubscriptionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerEventId" TEXT NOT NULL,
    "paidPeriodKey" TEXT,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "transactionId" TEXT,
    "purchasedAt" DATETIME,
    "priceCents" INTEGER,
    "currency" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SubscriptionEvent_providerEventId_key" ON "SubscriptionEvent"("providerEventId");
CREATE UNIQUE INDEX "SubscriptionEvent_paidPeriodKey_key" ON "SubscriptionEvent"("paidPeriodKey");
CREATE INDEX "SubscriptionEvent_userId_idx" ON "SubscriptionEvent"("userId");
CREATE INDEX "SubscriptionEvent_eventType_idx" ON "SubscriptionEvent"("eventType");

CREATE TABLE "ReferralPhoneClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "normalizedPhone" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralPhoneClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReferralPhoneClaim_normalizedPhone_key" ON "ReferralPhoneClaim"("normalizedPhone");
CREATE UNIQUE INDEX "ReferralPhoneClaim_userId_key" ON "ReferralPhoneClaim"("userId");

INSERT INTO "ReferralPhoneClaim" ("id", "normalizedPhone", "userId")
SELECT 'legacy-phone-' || min(p."userId"), p."normalizedPhone", min(p."userId")
FROM "WorkerProfile" p
INNER JOIN "User" u ON u."id" = p."userId"
WHERE p."normalizedPhone" IS NOT NULL
  AND trim(p."normalizedPhone") <> ''
  AND u."status" = 'ACTIVE'
  AND u."emailVerifiedAt" IS NOT NULL
GROUP BY p."normalizedPhone";
