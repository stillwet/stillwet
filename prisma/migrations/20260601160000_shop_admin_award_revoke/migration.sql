-- AlterTable
ALTER TABLE "ShopAdminAwardGrant" ADD COLUMN "revokedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ShopAdminAwardGrant_revokedAt_idx" ON "ShopAdminAwardGrant"("revokedAt");
