-- Public storefront/browse indexes for lower Postgres compute on anonymous traffic.
-- These support active public listings, shop browse ranking, product detail fallbacks,
-- and hot/popular home ranking queries.

CREATE INDEX IF NOT EXISTS "Product_active_storefrontViewCount_idx"
ON "Product" ("active", "storefrontViewCount" DESC);

CREATE INDEX IF NOT EXISTS "Product_active_updatedAt_idx"
ON "Product" ("active", "updatedAt" DESC);

CREATE INDEX IF NOT EXISTS "Product_primaryTagId_active_idx"
ON "Product" ("primaryTagId", "active");

CREATE INDEX IF NOT EXISTS "Shop_active_listed_sales_idx"
ON "Shop" ("active", "listedOnShopsBrowse", "totalSalesCents" DESC);

CREATE INDEX IF NOT EXISTS "Shop_active_listed_views_idx"
ON "Shop" ("active", "listedOnShopsBrowse", "storefrontViewCount" DESC);

CREATE INDEX IF NOT EXISTS "Shop_active_listed_editorial_idx"
ON "Shop" ("active", "listedOnShopsBrowse", "editorialPriority" DESC);

CREATE INDEX IF NOT EXISTS "Shop_flairTypeId_active_listed_idx"
ON "Shop" ("flairTypeId", "active", "listedOnShopsBrowse");

CREATE INDEX IF NOT EXISTS "ShopListing_shopId_active_updatedAt_idx"
ON "ShopListing" ("shopId", "active", "updatedAt" DESC);

CREATE INDEX IF NOT EXISTS "ShopListing_productId_active_updatedAt_idx"
ON "ShopListing" ("productId", "active", "updatedAt" DESC);

CREATE INDEX IF NOT EXISTS "ShopListing_public_visibility_idx"
ON "ShopListing" (
  "active",
  "creatorRemovedFromShopAt",
  "adminRemovedFromShopAt",
  "hiddenStorefrontForAccountDeletionAt"
);

CREATE INDEX IF NOT EXISTS "ShopListing_active_priceCents_idx"
ON "ShopListing" ("active", "priceCents");

CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx"
ON "Order" ("status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "OrderLine_productId_idx"
ON "OrderLine" ("productId");
