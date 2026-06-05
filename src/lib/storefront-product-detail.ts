import { unstable_cache } from "next/cache";
import { parseListingStorefrontCatalogImageSelection } from "@/lib/product-media";
import { prisma } from "@/lib/prisma";
import {
  sanitizeShopListingAdminSecondaryImageUrlForDisplay,
  sanitizeShopListingOwnerSupplementImageUrlForDisplay,
} from "@/lib/r2-upload";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import {
  loadStorefrontListingByShopAndProductSlug,
  loadStorefrontListingForProductWhenExactlyOne,
  loadStorefrontProductBySlug,
  type StorefrontProduct,
  type StorefrontShopListing,
} from "@/lib/product-storefront";
import { parseBaselinePick } from "@/lib/shop-baseline-catalog";
import {
  PUBLIC_STOREFRONT_CACHE_TAG,
  PUBLIC_STOREFRONT_REVALIDATE_SECONDS,
  publicProductCacheTag,
  publicShopCacheTag,
} from "@/lib/public-storefront-cache";

/**
 * Single Admin List “Storefront description” for PDP/checkout copy:
 * 1) Listing baseline catalog pick (exclusive — never merge other catalog rows),
 * 2) else first linked `AdminCatalogItem` on the product (platform link order),
 * 3) else first `AdminCatalogItem` with `itemPlatformProductId` = this product.
 * Never uses `Product.description` or merged multi-item text.
 */
export async function resolveAdminCatalogStorefrontText(
  product: StorefrontProduct,
  listing: { baselineCatalogPickEncoded?: string | null } | null,
): Promise<string> {
  if (listing?.baselineCatalogPickEncoded) {
    const pick = parseBaselinePick(listing.baselineCatalogPickEncoded);
    if (pick) {
      const item = await prisma.adminCatalogItem.findUnique({
        where: { id: pick.itemId },
        select: { storefrontDescription: true },
      });
      return item?.storefrontDescription?.trim() || "";
    }
  }

  for (const x of product.adminCatalogItemPlatformLinks ?? []) {
    const t = x.storefrontDescription?.trim();
    if (t) return t;
  }

  const direct = await prisma.adminCatalogItem.findFirst({
    where: { itemPlatformProductId: product.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { storefrontDescription: true },
  });
  return direct?.storefrontDescription?.trim() || "";
}

/** Admin List item `name` for this product: linked rows, else baseline pick, else `itemPlatformProductId`. */
export async function resolveAdminCatalogItemName(
  product: StorefrontProduct,
  listing: { baselineCatalogPickEncoded?: string | null } | null,
): Promise<string | null> {
  for (const x of product.adminCatalogItemPlatformLinks ?? []) {
    const n = x.name?.trim();
    if (n) return n;
  }
  if (listing?.baselineCatalogPickEncoded) {
    const pick = parseBaselinePick(listing.baselineCatalogPickEncoded);
    if (pick) {
      const item = await prisma.adminCatalogItem.findUnique({
        where: { id: pick.itemId },
        select: { name: true },
      });
      const n = item?.name?.trim();
      if (n) return n;
    }
  }
  const direct = await prisma.adminCatalogItem.findFirst({
    where: { itemPlatformProductId: product.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { name: true },
  });
  return direct?.name?.trim() || null;
}

/** Props bundle for {@link ProductDetailContent} from a listing row or bare product. */
export type ResolvedPublicProductDetail = {
  product: StorefrontProduct;
  tenant?: { shopSlug: string; listingPriceCents: number; shopDisplayName: string };
  adminListingSecondaryImageUrl?: string | null;
  ownerSupplementImageUrl?: string | null;
  listingStorefrontCatalogImageUrls?: string[];
  /**
   * Resolved Admin List storefront body for this listing/product (single catalog item; may be empty).
   * Never uses `Product.description`.
   */
  adminCatalogStorefrontDescription?: string;
  /** `ShopListing.requestItemName` when the PDP is tied to a listing; preferred for title with admin fallback. */
  listingItemName?: string | null;
  /** Admin List catalog item `name` (resolved server-side). */
  adminCatalogItemName?: string | null;
  /** Shop owner one-line pitch (`ShopListing.storefrontItemBlurb`). */
  storefrontItemBlurb?: string | null;
  /** Shop search hints (`ShopListing.listingSearchKeywords`). */
  listingSearchKeywords?: string | null;
};

async function withAdminCatalogStorefrontDescription(
  detail: ResolvedPublicProductDetail,
  listing: StorefrontShopListing | null,
): Promise<ResolvedPublicProductDetail> {
  const [adminCatalogStorefrontDescription, adminCatalogItemName] = await Promise.all([
    resolveAdminCatalogStorefrontText(detail.product, listing),
    resolveAdminCatalogItemName(detail.product, listing),
  ]);
  return { ...detail, adminCatalogStorefrontDescription, adminCatalogItemName };
}

export function mapListingRowToProductDetail(row: StorefrontShopListing): ResolvedPublicProductDetail {
  const catalogSel = parseListingStorefrontCatalogImageSelection(row.listingStorefrontCatalogImageUrls);
  return {
    product: row.product,
    tenant: {
      shopSlug: row.shop.slug,
      listingPriceCents: row.priceCents,
      shopDisplayName: row.shop.displayName,
    },
    adminListingSecondaryImageUrl: sanitizeShopListingAdminSecondaryImageUrlForDisplay(
      row.adminListingSecondaryImageUrl,
      row.shopId,
      row.id,
    ),
    ownerSupplementImageUrl: sanitizeShopListingOwnerSupplementImageUrlForDisplay(
      row.ownerSupplementImageUrl,
      row.shopId,
      row.id,
    ),
    listingStorefrontCatalogImageUrls: catalogSel === null ? undefined : catalogSel,
    listingItemName: row.requestItemName?.trim() || null,
    storefrontItemBlurb: row.storefrontItemBlurb?.trim() || null,
    listingSearchKeywords: row.listingSearchKeywords?.trim() || null,
  };
}

/**
 * For `/product/[slug]` and the intercepting modal: optional `?shop=` loads that shop’s live listing
 * (catalog selection, admin/owner images). Without `shop`, tries a single storefront-visible listing
 * for the product (any shop) first, then the platform shop listing, so creator-only listings are not
 * shadowed by the platform row. Otherwise falls back to the catalog product only.
 */
export async function resolvePublicProductDetail(
  productSlug: string,
  shopSlug?: string | null,
): Promise<ResolvedPublicProductDetail | null> {
  const shop = typeof shopSlug === "string" ? shopSlug.trim() : "";
  if (shop) {
    const row = await loadStorefrontListingByShopAndProductSlug(shop, productSlug);
    if (row) return withAdminCatalogStorefrontDescription(mapListingRowToProductDetail(row), row);
  } else {
    const uniqueRow = await loadStorefrontListingForProductWhenExactlyOne(productSlug);
    if (uniqueRow) {
      return withAdminCatalogStorefrontDescription(mapListingRowToProductDetail(uniqueRow), uniqueRow);
    }

    const platformRow = await loadStorefrontListingByShopAndProductSlug(
      PLATFORM_SHOP_SLUG,
      productSlug,
    );
    if (platformRow) {
      return withAdminCatalogStorefrontDescription(mapListingRowToProductDetail(platformRow), platformRow);
    }
  }
  const product = await loadStorefrontProductBySlug(productSlug);
  if (!product) return null;
  return withAdminCatalogStorefrontDescription({ product }, null);
}

export async function resolveCachedPublicProductDetail(
  productSlug: string,
  shopSlug?: string | null,
): Promise<ResolvedPublicProductDetail | null> {
  const normalizedShop = typeof shopSlug === "string" ? shopSlug.trim() : "";
  return unstable_cache(
    () => resolvePublicProductDetail(productSlug, normalizedShop || null),
    ["public-product-detail-v1", productSlug, normalizedShop || "platform"],
    {
      revalidate: PUBLIC_STOREFRONT_REVALIDATE_SECONDS,
      tags: [
        PUBLIC_STOREFRONT_CACHE_TAG,
        publicProductCacheTag(productSlug),
        ...(normalizedShop ? [publicShopCacheTag(normalizedShop)] : []),
      ],
    },
  )();
}
