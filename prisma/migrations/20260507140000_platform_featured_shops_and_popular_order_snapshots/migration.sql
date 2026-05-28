-- Daily snapshot rows for featured shops strip + full-catalog Popular browse order.
CREATE TABLE "PlatformFeaturedShopsSnapshot" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "shopIdsOrdered" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformFeaturedShopsSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformPopularListingOrderSnapshot" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "listingIdsOrdered" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformPopularListingOrderSnapshot_pkey" PRIMARY KEY ("id")
);
