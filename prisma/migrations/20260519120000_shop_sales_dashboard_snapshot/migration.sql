-- CreateTable
CREATE TABLE "ShopSalesDashboardSnapshot" (
    "shopId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "builtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopSalesDashboardSnapshot_pkey" PRIMARY KEY ("shopId")
);

-- AddForeignKey
ALTER TABLE "ShopSalesDashboardSnapshot"
ADD CONSTRAINT "ShopSalesDashboardSnapshot_shopId_fkey"
FOREIGN KEY ("shopId") REFERENCES "Shop"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "ShopOwnerNotice" ADD COLUMN "relatedOrderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ShopOwnerNotice_shopId_kind_relatedOrderId_key" ON "ShopOwnerNotice"("shopId", "kind", "relatedOrderId");
