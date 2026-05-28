-- Scale: faster ILIKE search on listing browse (`contains` + insensitive).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "ShopListing_listingSearchKeywords_trgm_idx"
ON "ShopListing" USING gin ("listingSearchKeywords" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ShopListing_requestItemName_trgm_idx"
ON "ShopListing" USING gin ("requestItemName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Product_name_trgm_idx"
ON "Product" USING gin ("name" gin_trgm_ops);
