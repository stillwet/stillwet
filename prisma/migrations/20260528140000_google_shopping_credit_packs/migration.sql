-- Google Shopping: credit packs + per-listing enrollment (replaces shop-wide access flag).

-- AlterTable Shop
ALTER TABLE "Shop" ADD COLUMN "googleShoppingCredits" INTEGER NOT NULL DEFAULT 0;

-- Legacy shop-wide purchasers → 10 unused credits
UPDATE "Shop" SET "googleShoppingCredits" = 10 WHERE "googleShoppingPurchasedAt" IS NOT NULL;

-- AlterTable ShopGoogleShoppingPurchase
ALTER TABLE "ShopGoogleShoppingPurchase" ADD COLUMN "packId" TEXT;
ALTER TABLE "ShopGoogleShoppingPurchase" ADD COLUMN "creditsGranted" INTEGER;

UPDATE "ShopGoogleShoppingPurchase"
SET "packId" = 'legacy_access', "creditsGranted" = 0
WHERE "packId" IS NULL;

ALTER TABLE "ShopGoogleShoppingPurchase" ALTER COLUMN "packId" SET NOT NULL;
ALTER TABLE "ShopGoogleShoppingPurchase" ALTER COLUMN "creditsGranted" SET NOT NULL;

-- DropTable column Shop.googleShoppingPurchasedAt
ALTER TABLE "Shop" DROP COLUMN "googleShoppingPurchasedAt";

-- CreateTable ShopListingGoogleShoppingEnrollment
CREATE TABLE "ShopListingGoogleShoppingEnrollment" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopListingId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enrolledByShopUserId" TEXT NOT NULL,

    CONSTRAINT "ShopListingGoogleShoppingEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopListingGoogleShoppingEnrollment_shopListingId_key" ON "ShopListingGoogleShoppingEnrollment"("shopListingId");

-- CreateIndex
CREATE INDEX "ShopListingGoogleShoppingEnrollment_shopId_enrolledAt_idx" ON "ShopListingGoogleShoppingEnrollment"("shopId", "enrolledAt" DESC);

-- AddForeignKey
ALTER TABLE "ShopListingGoogleShoppingEnrollment" ADD CONSTRAINT "ShopListingGoogleShoppingEnrollment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopListingGoogleShoppingEnrollment" ADD CONSTRAINT "ShopListingGoogleShoppingEnrollment_shopListingId_fkey" FOREIGN KEY ("shopListingId") REFERENCES "ShopListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopListingGoogleShoppingEnrollment" ADD CONSTRAINT "ShopListingGoogleShoppingEnrollment_enrolledByShopUserId_fkey" FOREIGN KEY ("enrolledByShopUserId") REFERENCES "ShopUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
