-- Preserve authoritative RevenueCat ordering so delayed restore snapshots cannot
-- overwrite newer lifecycle events.
ALTER TABLE "UserSubscription" ADD COLUMN "providerUpdatedAt" DATETIME;

-- Existing RevenueCat rows predate provider timestamps. Treat the last local
-- write time as the deployment ordering floor so a delayed pre-deployment
-- webhook cannot become the first authoritative update after this migration.
-- This assumes updatedAt reflects the most recent persisted subscription state;
-- later RevenueCat events replace it only when their provider timestamp is newer.
UPDATE "UserSubscription"
SET "providerUpdatedAt" = "updatedAt"
WHERE "provider" = 'revenuecat'
  AND "providerUpdatedAt" IS NULL;
