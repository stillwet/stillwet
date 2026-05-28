-- Shop flair: one selectable dimension (ShopFlairType) only — drop choices and requests.

ALTER TABLE "Shop" ADD COLUMN "flairTypeId" TEXT;

UPDATE "Shop" s
SET "flairTypeId" = c."typeId"
FROM "ShopFlairChoice" c
WHERE s."flairChoiceId" = c."id";

ALTER TABLE "Shop" DROP CONSTRAINT "Shop_flairChoiceId_fkey";
ALTER TABLE "Shop" DROP COLUMN "flairChoiceId";

ALTER TABLE "Shop"
  ADD CONSTRAINT "Shop_flairTypeId_fkey"
  FOREIGN KEY ("flairTypeId") REFERENCES "ShopFlairType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP TABLE IF EXISTS "ShopFlairRequest";

DROP TYPE IF EXISTS "ShopFlairRequestStatus";

DROP TABLE IF EXISTS "ShopFlairChoice";
