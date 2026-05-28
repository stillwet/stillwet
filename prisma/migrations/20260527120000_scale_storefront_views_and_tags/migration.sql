-- Scale: buffered storefront views, platform store-tags snapshot.

CREATE TYPE "StorefrontViewTargetKind" AS ENUM ('product', 'shop');

CREATE TABLE "StorefrontViewEvent" (
    "id" TEXT NOT NULL,
    "kind" "StorefrontViewTargetKind" NOT NULL,
    "targetSlug" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorefrontViewEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StorefrontViewEvent_createdAt_idx" ON "StorefrontViewEvent"("createdAt");
CREATE INDEX "StorefrontViewEvent_kind_targetSlug_idx" ON "StorefrontViewEvent"("kind", "targetSlug");

CREATE TABLE "PlatformStoreTagsSnapshot" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "tagsJson" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformStoreTagsSnapshot_pkey" PRIMARY KEY ("id")
);
