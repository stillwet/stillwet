-- Shop inactivity lifecycle, reactivation purchases, and proceeds routing.

CREATE TYPE "ShopReactivationPurchaseStatus" AS ENUM ('pending', 'paid', 'canceled', 'failed');
CREATE TYPE "OrderProceedsRouting" AS ENUM ('standard', 'platform_inactivity_deactivated');

ALTER TABLE "Shop"
  ADD COLUMN "inactivityWarningSentAt" TIMESTAMP(3),
  ADD COLUMN "inactivityDeactivatedAt" TIMESTAMP(3),
  ADD COLUMN "inactivityDeletionTriggeredAt" TIMESTAMP(3);

ALTER TABLE "ShopUser"
  ADD COLUMN "lastLoginAt" TIMESTAMP(3);

ALTER TABLE "Order"
  ADD COLUMN "proceedsRouting" "OrderProceedsRouting" NOT NULL DEFAULT 'standard';

CREATE TABLE "ShopReactivationPurchase" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "shopUserId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "status" "ShopReactivationPurchaseStatus" NOT NULL DEFAULT 'pending',
  "stripeCheckoutSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ShopReactivationPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopReactivationPurchase_stripeCheckoutSessionId_key" ON "ShopReactivationPurchase"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "ShopReactivationPurchase_stripePaymentIntentId_key" ON "ShopReactivationPurchase"("stripePaymentIntentId");
CREATE INDEX "ShopReactivationPurchase_shopId_createdAt_idx" ON "ShopReactivationPurchase"("shopId", "createdAt" DESC);
CREATE INDEX "ShopReactivationPurchase_shopUserId_createdAt_idx" ON "ShopReactivationPurchase"("shopUserId", "createdAt" DESC);
CREATE INDEX "ShopReactivationPurchase_status_paidAt_idx" ON "ShopReactivationPurchase"("status", "paidAt");
CREATE INDEX "Shop_inactivityDeactivatedAt_idx" ON "Shop"("inactivityDeactivatedAt");
CREATE INDEX "ShopUser_lastLoginAt_idx" ON "ShopUser"("lastLoginAt");
CREATE INDEX "Order_shopId_proceedsRouting_createdAt_idx" ON "Order"("shopId", "proceedsRouting", "createdAt");

ALTER TABLE "ShopReactivationPurchase"
  ADD CONSTRAINT "ShopReactivationPurchase_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShopReactivationPurchase"
  ADD CONSTRAINT "ShopReactivationPurchase_shopUserId_fkey"
  FOREIGN KEY ("shopUserId") REFERENCES "ShopUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
