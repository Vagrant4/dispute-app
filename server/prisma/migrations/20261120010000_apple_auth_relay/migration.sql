-- Stores only short-lived, single-use Apple web-flow hand-offs. No user identity exists yet.
CREATE TABLE "AppleAuthRelayResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stateHash" TEXT NOT NULL,
    "nonceHash" TEXT NOT NULL,
    "idToken" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "AppleAuthRelayResult_stateHash_key" ON "AppleAuthRelayResult"("stateHash");
CREATE INDEX "AppleAuthRelayResult_expiresAt_idx" ON "AppleAuthRelayResult"("expiresAt");
