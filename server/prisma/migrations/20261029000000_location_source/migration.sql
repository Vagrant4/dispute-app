ALTER TABLE "TimeEntry" ADD COLUMN "locationSource" TEXT NOT NULL DEFAULT 'typed';
UPDATE "TimeEntry" SET "locationSource" = 'legacy';
