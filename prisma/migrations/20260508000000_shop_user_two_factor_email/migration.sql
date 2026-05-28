-- AlterTable
ALTER TABLE "ShopUser" ADD COLUMN "twoFactorEmailEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ShopTwoFactorLoginChallenge" (
    "id" TEXT NOT NULL,
    "shopUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceIdHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopTwoFactorLoginChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopTrustedDevice" (
    "id" TEXT NOT NULL,
    "shopUserId" TEXT NOT NULL,
    "deviceIdHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopTrustedDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopTwoFactorLoginChallenge_tokenHash_key" ON "ShopTwoFactorLoginChallenge"("tokenHash");

-- CreateIndex
CREATE INDEX "ShopTwoFactorLoginChallenge_shopUserId_idx" ON "ShopTwoFactorLoginChallenge"("shopUserId");

-- CreateIndex
CREATE INDEX "ShopTwoFactorLoginChallenge_deviceIdHash_idx" ON "ShopTwoFactorLoginChallenge"("deviceIdHash");

-- CreateIndex
CREATE UNIQUE INDEX "ShopTrustedDevice_shopUserId_deviceIdHash_key" ON "ShopTrustedDevice"("shopUserId", "deviceIdHash");

-- CreateIndex
CREATE INDEX "ShopTrustedDevice_shopUserId_idx" ON "ShopTrustedDevice"("shopUserId");

-- AddForeignKey
ALTER TABLE "ShopTwoFactorLoginChallenge" ADD CONSTRAINT "ShopTwoFactorLoginChallenge_shopUserId_fkey" FOREIGN KEY ("shopUserId") REFERENCES "ShopUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopTrustedDevice" ADD CONSTRAINT "ShopTrustedDevice_shopUserId_fkey" FOREIGN KEY ("shopUserId") REFERENCES "ShopUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

