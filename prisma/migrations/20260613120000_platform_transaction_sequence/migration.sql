-- Platform-wide per-product transaction sequence counters and purchase row numbers for Stripe labels.

CREATE TABLE "PlatformTransactionSequence" (
    "productKey" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlatformTransactionSequence_pkey" PRIMARY KEY ("productKey")
);

ALTER TABLE "SupportTip" ADD COLUMN "transactionNumber" INTEGER;
ALTER TABLE "SupportTip" ALTER COLUMN "stripeCheckoutSessionId" DROP NOT NULL;

ALTER TABLE "ShopFlairPurchase" ADD COLUMN "transactionNumber" INTEGER;
ALTER TABLE "ShopGoogleShoppingPurchase" ADD COLUMN "transactionNumber" INTEGER;
ALTER TABLE "PromotionPurchase" ADD COLUMN "transactionNumber" INTEGER;
ALTER TABLE "ListingCreditPackPurchase" ADD COLUMN "transactionNumber" INTEGER;
ALTER TABLE "ShopSetupFeePurchase" ADD COLUMN "transactionNumber" INTEGER;
ALTER TABLE "ShopReactivationPurchase" ADD COLUMN "transactionNumber" INTEGER;
ALTER TABLE "CreatorGiftPurchase" ADD COLUMN "transactionNumber" INTEGER;
