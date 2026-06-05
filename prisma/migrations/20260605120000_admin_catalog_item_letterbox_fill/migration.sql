-- CreateEnum
CREATE TYPE "ListingArtworkLetterboxFill" AS ENUM ('transparent', 'white');

-- AlterTable
ALTER TABLE "AdminCatalogItem" ADD COLUMN "itemArtworkLetterboxFill" "ListingArtworkLetterboxFill" NOT NULL DEFAULT 'transparent';

-- Backfill physical print items (canvas, poster, paper, etc.)
UPDATE "AdminCatalogItem"
SET "itemArtworkLetterboxFill" = 'white'
WHERE LOWER("name") LIKE '%canvas%'
   OR LOWER("name") LIKE '%poster%'
   OR LOWER("name") LIKE '%gloss%'
   OR LOWER("name") LIKE '%towel%'
   OR LOWER("name") LIKE '%paper%';
