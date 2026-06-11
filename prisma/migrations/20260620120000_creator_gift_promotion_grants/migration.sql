-- CreateTable
CREATE TABLE "CreatorGiftPromotionGrant" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "kind" "PromotionKind" NOT NULL,
    "credits" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorGiftPromotionGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreatorGiftPromotionGrant_purchaseId_idx" ON "CreatorGiftPromotionGrant"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorGiftPromotionGrant_purchaseId_kind_key" ON "CreatorGiftPromotionGrant"("purchaseId", "kind");

-- AddForeignKey
ALTER TABLE "CreatorGiftPromotionGrant" ADD CONSTRAINT "CreatorGiftPromotionGrant_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "CreatorGiftPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from legacy single-kind columns
INSERT INTO "CreatorGiftPromotionGrant" ("id", "purchaseId", "kind", "credits", "createdAt")
SELECT
    'cgpg_' || "id",
    "id",
    "promotionKind",
    "promotionCreditsGranted",
    COALESCE("createdAt", CURRENT_TIMESTAMP)
FROM "CreatorGiftPurchase"
WHERE "promotionKind" IS NOT NULL
  AND "promotionCreditsGranted" > 0;
