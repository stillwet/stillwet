-- CreateTable
CREATE TABLE "ShopPromotionsDashboardSnapshot" (
    "shopId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "builtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopPromotionsDashboardSnapshot_pkey" PRIMARY KEY ("shopId")
);

-- AddForeignKey
ALTER TABLE "ShopPromotionsDashboardSnapshot"
ADD CONSTRAINT "ShopPromotionsDashboardSnapshot_shopId_fkey"
FOREIGN KEY ("shopId") REFERENCES "Shop"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

