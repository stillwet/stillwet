-- CreateEnum
CREATE TYPE "ShopFlairPurchaseStatus" AS ENUM ('pending', 'paid', 'failed', 'canceled');

-- CreateEnum
CREATE TYPE "ShopFlairRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN "flairChoiceId" TEXT;
ALTER TABLE "Shop" ADD COLUMN "flairPurchasedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ShopFlairType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopFlairType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopFlairChoice" (
    "id" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopFlairChoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopFlairPurchase" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopUserId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "ShopFlairPurchaseStatus" NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopFlairPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopFlairRequest" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopUserId" TEXT NOT NULL,
    "requestedLabel" VARCHAR(120) NOT NULL,
    "requestedTypeId" TEXT,
    "status" "ShopFlairRequestStatus" NOT NULL DEFAULT 'pending',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopFlairRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopFlairType_slug_key" ON "ShopFlairType"("slug");

-- CreateIndex
CREATE INDEX "ShopFlairChoice_typeId_sortOrder_idx" ON "ShopFlairChoice"("typeId", "sortOrder");

-- CreateIndex
CREATE INDEX "ShopFlairPurchase_shopId_createdAt_idx" ON "ShopFlairPurchase"("shopId", "createdAt" DESC);
CREATE INDEX "ShopFlairPurchase_shopUserId_createdAt_idx" ON "ShopFlairPurchase"("shopUserId", "createdAt" DESC);
CREATE INDEX "ShopFlairPurchase_status_idx" ON "ShopFlairPurchase"("status");

-- CreateIndex
CREATE INDEX "ShopFlairRequest_status_createdAt_idx" ON "ShopFlairRequest"("status", "createdAt" DESC);
CREATE INDEX "ShopFlairRequest_shopId_createdAt_idx" ON "ShopFlairRequest"("shopId", "createdAt" DESC);
CREATE INDEX "ShopFlairRequest_shopUserId_createdAt_idx" ON "ShopFlairRequest"("shopUserId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "ShopFlairChoice" ADD CONSTRAINT "ShopFlairChoice_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ShopFlairType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopFlairPurchase" ADD CONSTRAINT "ShopFlairPurchase_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopFlairPurchase" ADD CONSTRAINT "ShopFlairPurchase_shopUserId_fkey" FOREIGN KEY ("shopUserId") REFERENCES "ShopUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopFlairRequest" ADD CONSTRAINT "ShopFlairRequest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopFlairRequest" ADD CONSTRAINT "ShopFlairRequest_shopUserId_fkey" FOREIGN KEY ("shopUserId") REFERENCES "ShopUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopFlairRequest" ADD CONSTRAINT "ShopFlairRequest_requestedTypeId_fkey" FOREIGN KEY ("requestedTypeId") REFERENCES "ShopFlairType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_flairChoiceId_fkey" FOREIGN KEY ("flairChoiceId") REFERENCES "ShopFlairChoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

