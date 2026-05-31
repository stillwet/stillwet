-- CreateEnum
CREATE TYPE "CreatorGiftFulfillmentMode" AS ENUM ('email_codes', 'direct_to_shop');

-- AlterTable
ALTER TABLE "CreatorGiftPurchase" ALTER COLUMN "purchaserEmail" DROP NOT NULL;

ALTER TABLE "CreatorGiftPurchase" ADD COLUMN "fulfillmentMode" "CreatorGiftFulfillmentMode" NOT NULL DEFAULT 'email_codes';
ALTER TABLE "CreatorGiftPurchase" ADD COLUMN "recipientShopId" TEXT;
ALTER TABLE "CreatorGiftPurchase" ADD COLUMN "giftFromName" TEXT;

-- CreateIndex
CREATE INDEX "CreatorGiftPurchase_recipientShopId_idx" ON "CreatorGiftPurchase"("recipientShopId");

-- AddForeignKey
ALTER TABLE "CreatorGiftPurchase" ADD CONSTRAINT "CreatorGiftPurchase_recipientShopId_fkey" FOREIGN KEY ("recipientShopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
