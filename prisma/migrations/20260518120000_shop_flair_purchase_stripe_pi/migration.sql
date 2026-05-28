-- AlterTable
ALTER TABLE "ShopFlairPurchase" ADD COLUMN "stripePaymentIntentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ShopFlairPurchase_stripePaymentIntentId_key" ON "ShopFlairPurchase"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "ShopFlairPurchase_status_paidAt_idx" ON "ShopFlairPurchase"("status", "paidAt");

-- DropIndex
DROP INDEX "ShopFlairPurchase_status_idx";
