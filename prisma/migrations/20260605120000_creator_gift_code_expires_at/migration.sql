-- AlterTable
ALTER TABLE "CreatorGiftCode" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Backfill purchased shop-setup gift codes (exclude admin waived-fee and beta batches).
UPDATE "CreatorGiftCode" c
SET "expiresAt" = c."createdAt" + INTERVAL '365 days'
WHERE c."type" = 'shop_setup'
  AND c."expiresAt" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "CreatorGiftPurchase" p
    WHERE p.id = c."purchaseId"
      AND p."setupFeeIncluded" = true
      AND p."isBetaTesterBatch" = false
      AND p."isWaivedShopFeeBatch" = false
      AND p."status" = 'paid'
  );

-- CreateIndex
CREATE INDEX "CreatorGiftCode_type_expiresAt_idx" ON "CreatorGiftCode"("type", "expiresAt");
