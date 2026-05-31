-- AlterTable
ALTER TABLE "Shop" ADD COLUMN "adminFrozenAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Shop_adminFrozenAt_idx" ON "Shop"("adminFrozenAt");
