import { PromotionKind, PromotionPurchaseStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import {
  getOrderedHotFeaturedItemProductIds,
  getOrderedPopularFeaturedItemProductIds,
} from "@/lib/platform-all-page-featured";
import { isPaidPromotionActiveNow } from "@/lib/promotion-policy-shared";
import { promotionKindLabel } from "@/lib/promotions";
import { CREATOR_SHOP_BASE } from "@/lib/shops-browse-page-featured-compute";
import { marketplaceAggregatedListingWhere } from "@/lib/shop-listing-storefront-visibility";

export type AdminActivePromotionPickerPayload = {
  shops: { id: string; displayName: string }[];
  productsByShopId: Record<string, { productId: string; label: string }[]>;
  labelsByProductId: Record<string, string>;
};

const LISTING_PROMOTION_KINDS = new Set<PromotionKind>([
  PromotionKind.HOT_FEATURED_ITEM,
  PromotionKind.MOST_POPULAR_OF_TAG_ITEM,
]);

/** Pin order ∩ active set, then append remaining active ids in promo default order. */
export function mergeAdminFeaturedOrder(
  savedIds: string[],
  activeIds: string[],
  max: number,
): string[] {
  const activeSet = new Set(activeIds);
  const out: string[] = [];
  for (const id of savedIds) {
    if (activeSet.has(id)) out.push(id);
  }
  const inOut = new Set(out);
  for (const id of activeIds) {
    if (!inOut.has(id)) out.push(id);
  }
  return out.slice(0, max);
}

export async function getOrderedActiveHotFeaturedProductIds(): Promise<string[]> {
  return getOrderedHotFeaturedItemProductIds();
}

export async function getOrderedActivePopularFeaturedProductIds(): Promise<string[]> {
  return getOrderedPopularFeaturedItemProductIds();
}

/** Active paid Featured shop home placements — newest payment first, deduped by shop. */
export async function getOrderedActiveFeaturedShopHomeShopIds(): Promise<string[]> {
  const purchases = await prisma.promotionPurchase.findMany({
    where: {
      kind: PromotionKind.FEATURED_SHOP_HOME,
      status: PromotionPurchaseStatus.paid,
      paidAt: { not: null },
      shop: CREATOR_SHOP_BASE,
    },
    select: {
      status: true,
      paidAt: true,
      eligibleFrom: true,
      shopId: true,
    },
    orderBy: { paidAt: "desc" },
  });

  const bestActiveByShop = new Map<string, Date>();
  for (const p of purchases) {
    if (!isPaidPromotionActiveNow(p) || !p.paidAt) continue;
    const cur = bestActiveByShop.get(p.shopId);
    if (!cur || p.paidAt.getTime() > cur.getTime()) {
      bestActiveByShop.set(p.shopId, p.paidAt);
    }
  }

  return [...bestActiveByShop.entries()]
    .sort((a, b) => b[1].getTime() - a[1].getTime())
    .map(([shopId]) => shopId);
}

async function activeProductIdsForListingPromotionKind(kind: PromotionKind): Promise<Set<string>> {
  if (kind === PromotionKind.HOT_FEATURED_ITEM) {
    return new Set(await getOrderedActiveHotFeaturedProductIds());
  }
  if (kind === PromotionKind.MOST_POPULAR_OF_TAG_ITEM) {
    return new Set(await getOrderedActivePopularFeaturedProductIds());
  }
  return new Set();
}

export async function loadActivePromotionListingPicker(
  kind: PromotionKind,
): Promise<AdminActivePromotionPickerPayload> {
  if (!LISTING_PROMOTION_KINDS.has(kind)) {
    return { shops: [], productsByShopId: {}, labelsByProductId: {} };
  }

  const activeProductIds = await activeProductIdsForListingPromotionKind(kind);
  if (activeProductIds.size === 0) {
    return { shops: [], productsByShopId: {}, labelsByProductId: {} };
  }

  const promos = await prisma.promotionPurchase.findMany({
    where: {
      kind,
      status: PromotionPurchaseStatus.paid,
      paidAt: { not: null },
      shopListing: {
        is: {
          ...marketplaceAggregatedListingWhere,
          product: { active: true },
          productId: { in: [...activeProductIds] },
        },
      },
    },
    orderBy: { paidAt: "desc" },
    select: {
      status: true,
      paidAt: true,
      eligibleFrom: true,
      shopListing: {
        select: {
          shopId: true,
          productId: true,
          requestItemName: true,
          product: { select: { name: true } },
          shop: { select: { displayName: true } },
        },
      },
    },
  });

  const byShop = new Map<string, { productId: string; label: string }[]>();
  const shopDisplayNameById = new Map<string, string>();
  const labelsByProductId: Record<string, string> = {};
  const seenProduct = new Set<string>();

  for (const pp of promos) {
    if (!isPaidPromotionActiveNow(pp)) continue;
    const listing = pp.shopListing;
    if (!listing || !activeProductIds.has(listing.productId)) continue;
    if (seenProduct.has(listing.productId)) continue;
    seenProduct.add(listing.productId);

    shopDisplayNameById.set(listing.shopId, listing.shop.displayName);
    const itemLabel = listing.requestItemName?.trim() || listing.product.name;
    const list = byShop.get(listing.shopId) ?? [];
    list.push({ productId: listing.productId, label: itemLabel });
    byShop.set(listing.shopId, list);
    labelsByProductId[listing.productId] = itemLabel;
  }

  const shops = [...shopDisplayNameById.entries()]
    .map(([id, displayName]) => ({ id, displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }));

  const productsByShopId: Record<string, { productId: string; label: string }[]> = {};
  for (const [sid, products] of byShop) {
    productsByShopId[sid] = [...products].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
  }

  return { shops, productsByShopId, labelsByProductId };
}

export async function loadActiveFeaturedShopHomePickerShops(): Promise<
  { id: string; displayName: string; slug: string; listingFeeBonusFreeSlots: number | null }[]
> {
  const shopIds = await getOrderedActiveFeaturedShopHomeShopIds();
  if (shopIds.length === 0) return [];

  const rows = await prisma.shop.findMany({
    where: {
      id: { in: shopIds },
      slug: { not: PLATFORM_SHOP_SLUG },
      active: true,
    },
    select: { id: true, displayName: true, slug: true, listingFeeBonusFreeSlots: true },
  });

  const byId = new Map(rows.map((r) => [r.id, r]));
  return shopIds
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => r != null);
}

export async function assertProductIdsHaveActivePromotion(
  kind:
    | typeof PromotionKind.HOT_FEATURED_ITEM
    | typeof PromotionKind.MOST_POPULAR_OF_TAG_ITEM,
  productIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (productIds.length === 0) return { ok: true };

  const active = await activeProductIdsForListingPromotionKind(kind);
  const missing = productIds.filter((id) => !active.has(id));
  if (missing.length === 0) return { ok: true };

  const label = promotionKindLabel(kind);
  return {
    ok: false,
    error: `Each item must have an active ${label} placement in the current window. Not active: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`,
  };
}

export async function assertShopIdsHaveActiveFeaturedShopPromotion(
  shopIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (shopIds.length === 0) return { ok: true };

  const active = new Set(await getOrderedActiveFeaturedShopHomeShopIds());
  const missing = shopIds.filter((id) => !active.has(id));
  if (missing.length === 0) return { ok: true };

  const label = promotionKindLabel(PromotionKind.FEATURED_SHOP_HOME);
  return {
    ok: false,
    error: `Each shop must have an active ${label} placement in the current window. Not active: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`,
  };
}
