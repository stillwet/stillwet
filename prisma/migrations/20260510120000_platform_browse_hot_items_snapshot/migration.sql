-- Precomputed Hot items carousel listing ids for `/shop/all` (rebuilt daily via cron).
CREATE TABLE "PlatformBrowseHotItemsSnapshot" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "listingIdsOrdered" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformBrowseHotItemsSnapshot_pkey" PRIMARY KEY ("id")
);
