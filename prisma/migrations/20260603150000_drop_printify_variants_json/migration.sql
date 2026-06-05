-- Drop multi-variant JSON; one listing = one Printify variant id + one shop price.
ALTER TABLE "Product" DROP COLUMN IF EXISTS "printifyVariants";
ALTER TABLE "ShopListing" DROP COLUMN IF EXISTS "listingPrintifyVariantPrices";
