-- Keep the most recently updated subscription if legacy data contains more
-- than one row for a user, then enforce the one-current-subscription invariant.
DELETE FROM "UserSubscription"
WHERE "id" NOT IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "userId"
        ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
      ) AS "owner_rank"
    FROM "UserSubscription"
  ) AS "ranked_subscriptions"
  WHERE "owner_rank" = 1
);

DROP INDEX IF EXISTS "UserSubscription_userId_idx";
CREATE UNIQUE INDEX "UserSubscription_userId_key" ON "UserSubscription"("userId");
