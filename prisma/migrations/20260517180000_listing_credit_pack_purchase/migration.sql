-- CreateEnum
CREATE TYPE "ListingCreditPackPurchaseStatus" AS ENUM ('pending', 'paid', 'canceled', 'failed');

-- CreateTable
CREATE TABLE "ListingCreditPackPurchase" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopUserId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "creditsGranted" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "ListingCreditPackPurchaseStatus" NOT NULL DEFAULT 'pending',
    "stripePaymentIntentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingCreditPackPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListingCreditPackPurchase_stripePaymentIntentId_key" ON "ListingCreditPackPurchase"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "ListingCreditPackPurchase_shopId_createdAt_idx" ON "ListingCreditPackPurchase"("shopId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ListingCreditPackPurchase_status_paidAt_idx" ON "ListingCreditPackPurchase"("status", "paidAt");

-- AddForeignKey
ALTER TABLE "ListingCreditPackPurchase" ADD CONSTRAINT "ListingCreditPackPurchase_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingCreditPackPurchase" ADD CONSTRAINT "ListingCreditPackPurchase_shopUserId_fkey" FOREIGN KEY ("shopUserId") REFERENCES "ShopUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
