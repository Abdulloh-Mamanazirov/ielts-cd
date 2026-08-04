-- CreateEnum
CREATE TYPE "TestSeries" AS ENUM ('REAL_EXAM', 'CAMBRIDGE');

-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "mockOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "series" "TestSeries" NOT NULL DEFAULT 'REAL_EXAM',
ADD COLUMN     "seriesNumber" INTEGER,
ADD COLUMN     "testNumber" INTEGER;

-- CreateIndex
CREATE INDEX "Test_skill_series_seriesNumber_idx" ON "Test"("skill", "series", "seriesNumber");

-- Backfill: every test already in the library encodes its place in its slug,
-- e.g. "reading-volume-4-test-1" or "listening-cambridge-21-test-3". Parse it
-- here so the shelf can group by book and volume without a re-import. Tests
-- whose slug says neither keep series REAL_EXAM with no numbers, which lists
-- them under an "Other" group rather than hiding them.
UPDATE "Test"
SET "series" = 'CAMBRIDGE',
    "seriesNumber" = NULLIF(substring("slug" from 'cambridge-([0-9]+)'), '')::int
WHERE "slug" ~ 'cambridge-[0-9]+';

UPDATE "Test"
SET "seriesNumber" = NULLIF(substring("slug" from 'volume-([0-9]+)'), '')::int
WHERE "slug" ~ 'volume-[0-9]+';

UPDATE "Test"
SET "testNumber" = NULLIF(substring("slug" from 'test-([0-9]+)'), '')::int
WHERE "slug" ~ 'test-[0-9]+';
