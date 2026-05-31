-- AlterTable
ALTER TABLE "PromotionPurchase" ADD COLUMN "paidViaPromotionCredit" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ShopPromotionCreditBalance" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "kind" "PromotionKind" NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopPromotionCreditBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopAdminAwardGrant" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "awardKey" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopAdminAwardGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopPromotionCreditBalance_shopId_idx" ON "ShopPromotionCreditBalance"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopPromotionCreditBalance_shopId_kind_key" ON "ShopPromotionCreditBalance"("shopId", "kind");

-- CreateIndex
CREATE INDEX "ShopAdminAwardGrant_shopId_grantedAt_idx" ON "ShopAdminAwardGrant"("shopId", "grantedAt" DESC);

-- CreateIndex
CREATE INDEX "ShopAdminAwardGrant_grantedAt_idx" ON "ShopAdminAwardGrant"("grantedAt" DESC);

-- AddForeignKey
ALTER TABLE "ShopPromotionCreditBalance" ADD CONSTRAINT "ShopPromotionCreditBalance_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopAdminAwardGrant" ADD CONSTRAINT "ShopAdminAwardGrant_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
