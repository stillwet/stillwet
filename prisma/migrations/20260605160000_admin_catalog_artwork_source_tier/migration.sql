-- CreateEnum
CREATE TYPE "AdminCatalogItemArtworkSourceTierOverride" AS ENUM ('auto', 'phone_pic_safe', 'camera_or_vector_only');

-- AlterTable
ALTER TABLE "AdminCatalogItem" ADD COLUMN "itemArtworkSourceTierOverride" "AdminCatalogItemArtworkSourceTierOverride" NOT NULL DEFAULT 'auto';
