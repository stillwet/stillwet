-- AlterEnum
ALTER TYPE "CreatorGiftCodeType" ADD VALUE 'promotion_credit';
ALTER TYPE "CreatorGiftCodeType" ADD VALUE 'google_shopping_credits';

-- AlterTable
ALTER TABLE "CreatorGiftPurchase" ADD COLUMN "googleShoppingCreditPackId" TEXT,
ADD COLUMN "googleShoppingCreditsGranted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "promotionKind" "PromotionKind",
ADD COLUMN "promotionCreditsGranted" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CreatorGiftCode" ADD COLUMN "googleShoppingCreditsGranted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "promotionKind" "PromotionKind",
ADD COLUMN "promotionCreditsGranted" INTEGER NOT NULL DEFAULT 0;
