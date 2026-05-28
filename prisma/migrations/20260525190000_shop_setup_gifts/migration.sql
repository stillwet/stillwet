-- Shop setup fee + creator gift codes.

CREATE TYPE "ShopSetupFeePurchaseStatus" AS ENUM ('pending', 'paid', 'canceled', 'failed');
CREATE TYPE "CreatorGiftPurchaseStatus" AS ENUM ('pending', 'paid', 'canceled', 'failed');
CREATE TYPE "CreatorGiftCodeType" AS ENUM ('shop_setup', 'listing_credits');

CREATE TABLE "PendingShopSignup" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PendingShopSignup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopSetupFeePurchase" (
  "id" TEXT NOT NULL,
  "pendingSignupId" TEXT NOT NULL,
  "shopId" TEXT,
  "shopUserId" TEXT,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "status" "ShopSetupFeePurchaseStatus" NOT NULL DEFAULT 'pending',
  "stripeCheckoutSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ShopSetupFeePurchase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreatorGiftPurchase" (
  "id" TEXT NOT NULL,
  "purchaserEmail" TEXT NOT NULL,
  "setupFeeIncluded" BOOLEAN NOT NULL DEFAULT false,
  "listingCreditPackId" TEXT,
  "listingCreditsGranted" INTEGER NOT NULL DEFAULT 0,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "status" "CreatorGiftPurchaseStatus" NOT NULL DEFAULT 'pending',
  "stripeCheckoutSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "paidAt" TIMESTAMP(3),
  "emailedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CreatorGiftPurchase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreatorGiftCode" (
  "id" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "type" "CreatorGiftCodeType" NOT NULL,
  "code" TEXT NOT NULL,
  "codeNormalized" TEXT NOT NULL,
  "listingCreditsGranted" INTEGER NOT NULL DEFAULT 0,
  "redeemedAt" TIMESTAMP(3),
  "redeemedByShopId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CreatorGiftCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PendingShopSignup_email_idx" ON "PendingShopSignup"("email");
CREATE INDEX "PendingShopSignup_expiresAt_idx" ON "PendingShopSignup"("expiresAt");

CREATE UNIQUE INDEX "ShopSetupFeePurchase_stripeCheckoutSessionId_key" ON "ShopSetupFeePurchase"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "ShopSetupFeePurchase_stripePaymentIntentId_key" ON "ShopSetupFeePurchase"("stripePaymentIntentId");
CREATE INDEX "ShopSetupFeePurchase_pendingSignupId_idx" ON "ShopSetupFeePurchase"("pendingSignupId");
CREATE INDEX "ShopSetupFeePurchase_shopId_createdAt_idx" ON "ShopSetupFeePurchase"("shopId", "createdAt" DESC);
CREATE INDEX "ShopSetupFeePurchase_status_paidAt_idx" ON "ShopSetupFeePurchase"("status", "paidAt");

CREATE UNIQUE INDEX "CreatorGiftPurchase_stripeCheckoutSessionId_key" ON "CreatorGiftPurchase"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "CreatorGiftPurchase_stripePaymentIntentId_key" ON "CreatorGiftPurchase"("stripePaymentIntentId");
CREATE INDEX "CreatorGiftPurchase_purchaserEmail_idx" ON "CreatorGiftPurchase"("purchaserEmail");
CREATE INDEX "CreatorGiftPurchase_status_paidAt_idx" ON "CreatorGiftPurchase"("status", "paidAt");

CREATE UNIQUE INDEX "CreatorGiftCode_code_key" ON "CreatorGiftCode"("code");
CREATE UNIQUE INDEX "CreatorGiftCode_codeNormalized_key" ON "CreatorGiftCode"("codeNormalized");
CREATE INDEX "CreatorGiftCode_purchaseId_type_idx" ON "CreatorGiftCode"("purchaseId", "type");
CREATE INDEX "CreatorGiftCode_type_redeemedAt_idx" ON "CreatorGiftCode"("type", "redeemedAt");
CREATE INDEX "CreatorGiftCode_redeemedByShopId_idx" ON "CreatorGiftCode"("redeemedByShopId");

ALTER TABLE "ShopSetupFeePurchase"
  ADD CONSTRAINT "ShopSetupFeePurchase_pendingSignupId_fkey"
  FOREIGN KEY ("pendingSignupId") REFERENCES "PendingShopSignup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShopSetupFeePurchase"
  ADD CONSTRAINT "ShopSetupFeePurchase_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShopSetupFeePurchase"
  ADD CONSTRAINT "ShopSetupFeePurchase_shopUserId_fkey"
  FOREIGN KEY ("shopUserId") REFERENCES "ShopUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CreatorGiftCode"
  ADD CONSTRAINT "CreatorGiftCode_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "CreatorGiftPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreatorGiftCode"
  ADD CONSTRAINT "CreatorGiftCode_redeemedByShopId_fkey"
  FOREIGN KEY ("redeemedByShopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
