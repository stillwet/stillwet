-- Speeds up publication-fee ordinal subqueries for admin listing requests and badge counts.
-- Apply with `npx prisma migrate deploy` when ready.

CREATE INDEX "ShopListing_shopId_createdAt_id_idx" ON "ShopListing"("shopId", "createdAt", "id");
