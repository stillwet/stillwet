-- CreateEnum
CREATE TYPE "ShopGoogleShoppingPurchaseStatus" AS ENUM ('pending', 'paid', 'failed', 'canceled');

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN "googleShoppingPurchasedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ShopGoogleShoppingPurchase" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopUserId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "ShopGoogleShoppingPurchaseStatus" NOT NULL DEFAULT 'pending',
    "stripePaymentIntentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopGoogleShoppingPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopGoogleShoppingPurchase_stripePaymentIntentId_key" ON "ShopGoogleShoppingPurchase"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "ShopGoogleShoppingPurchase_shopId_createdAt_idx" ON "ShopGoogleShoppingPurchase"("shopId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ShopGoogleShoppingPurchase_shopUserId_createdAt_idx" ON "ShopGoogleShoppingPurchase"("shopUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ShopGoogleShoppingPurchase_status_paidAt_idx" ON "ShopGoogleShoppingPurchase"("status", "paidAt");

-- AddForeignKey
ALTER TABLE "ShopGoogleShoppingPurchase" ADD CONSTRAINT "ShopGoogleShoppingPurchase_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopGoogleShoppingPurchase" ADD CONSTRAINT "ShopGoogleShoppingPurchase_shopUserId_fkey" FOREIGN KEY ("shopUserId") REFERENCES "ShopUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
