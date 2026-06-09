-- AlterTable
ALTER TABLE "AdminCatalogItem" ADD COLUMN "itemProductionFeeCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderLine" ADD COLUMN "productionFeeCents" INTEGER NOT NULL DEFAULT 0;
