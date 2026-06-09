-- AlterTable
ALTER TABLE "Shop" ADD COLUMN "secretMenuAccessGrantedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AdminCatalogItem" ADD COLUMN "itemSecretMenuOnly" BOOLEAN NOT NULL DEFAULT false;
