-- CreateEnum
CREATE TYPE "BetaTesterOnboardingStatus" AS ENUM ('in_progress', 'complete');

-- AlterTable
ALTER TABLE "CreatorGiftPurchase" ADD COLUMN "isBetaTesterBatch" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN "betaTesterAt" TIMESTAMP(3),
ADD COLUMN "betaTesterOnboardingStatus" "BetaTesterOnboardingStatus",
ADD COLUMN "betaTesterOnboardingCheckedAt" TIMESTAMP(3),
ADD COLUMN "betaTesterOnboardingCompletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Shop_betaTesterAt_idx" ON "Shop"("betaTesterAt");

-- CreateIndex
CREATE INDEX "CreatorGiftPurchase_isBetaTesterBatch_idx" ON "CreatorGiftPurchase"("isBetaTesterBatch");
