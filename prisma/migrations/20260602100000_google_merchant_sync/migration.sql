-- CreateEnum
CREATE TYPE "GoogleMerchantSyncStatus" AS ENUM ('pending', 'synced', 'error', 'removed');

-- AlterTable
ALTER TABLE "ShopListingGoogleShoppingEnrollment"
ADD COLUMN "gmcOfferId" TEXT,
ADD COLUMN "gmcProductName" VARCHAR(512),
ADD COLUMN "gmcSyncStatus" "GoogleMerchantSyncStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN "gmcSyncPayloadHash" VARCHAR(64),
ADD COLUMN "gmcLastSyncedAt" TIMESTAMP(3),
ADD COLUMN "gmcLastSyncError" TEXT,
ADD COLUMN "gmcApprovalStatus" VARCHAR(64),
ADD COLUMN "gmcLastStatusPollAt" TIMESTAMP(3),
ADD COLUMN "gmcRemovedFromMerchantAt" TIMESTAMP(3);

UPDATE "ShopListingGoogleShoppingEnrollment"
SET "gmcOfferId" = "shopListingId"
WHERE "gmcOfferId" IS NULL;

ALTER TABLE "ShopListingGoogleShoppingEnrollment"
ALTER COLUMN "gmcOfferId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "ShopListingGoogleShoppingEnrollment_gmcSyncStatus_gmcLastSyn_idx"
ON "ShopListingGoogleShoppingEnrollment"("gmcSyncStatus", "gmcLastSyncedAt");
