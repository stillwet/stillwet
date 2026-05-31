import { unstable_cache } from "next/cache";
import { PromotionKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import {
  getOrderedActiveFeaturedShopHomeShopIds,
  getOrderedActiveHotFeaturedProductIds,
  getOrderedActivePopularFeaturedProductIds,
  loadActivePromotionListingPicker,
  mergeAdminFeaturedOrder,
  type AdminActivePromotionPickerPayload,
} from "@/lib/admin-active-promotion-placements";
import { CREATOR_SHOP_BASE } from "@/lib/shops-browse-page-featured-compute";
import {
  HOME_HOT_CAROUSEL_MAX_ITEMS,
  SHOPS_BROWSE_PAGE_FEATURED_MAX_ITEMS,
} from "@/lib/platform-all-page-featured-constants";
import { parseShopOrderedFeaturedProductIds } from "@/lib/shop-ordered-featured-product-ids";
import { marketplaceAggregatedListingWhere } from "@/lib/shop-listing-storefront-visibility";

const PICKER_CACHE_S = 60 * 60 * 2;

export type AdminFeaturedProductPickerPayload = AdminActivePromotionPickerPayload;

export type AdminPromotionListsInitialPayload = {
  platformHomeHotCarouselInitialIds: string[];
  homeHotLabelsByProductId: Record<string, string>;
  activePopularProductIds: string[];
  permanentPopularProductIds: string[];
  popularLabelsByProductId: Record<string, string>;
  activeFeaturedShopIds: string[];
  permanentFeaturedShopIds: string[];
  permanentFeaturedShopOptions: { id: string; displayName: string; slug: string }[];
  activeFeaturedShopLabelsById: Record<string, string>;
};

/** Active + permanent featured state for Promotion lists tab. */
export async function loadAdminPromotionListsInitial(): Promise<AdminPromotionListsInitialPayload> {
  let savedHomeHot: string[] = [];
  let permanentPopular: string[] = [];
  let permanentFeaturedShops: string[] = [];

  const [activeHomeHot, activePopular, activeFeaturedShops] = await Promise.all([
    getOrderedActiveHotFeaturedProductIds(),
    getOrderedActivePopularFeaturedProductIds(),
    getOrderedActiveFeaturedShopHomeShopIds(),
  ]);

  try {
    const platformShop = await prisma.shop.findUnique({
      where: { slug: PLATFORM_SHOP_SLUG },
      select: { id: true },
    });
    if (platformShop) {
      const featuredRow = await prisma.shop.findUnique({
        where: { id: platformShop.id },
        select: {
          homeHotCarouselFeaturedProductIds: true,
          popularItemsFeaturedProductIds: true,
          browseShopsPageFeaturedShopIds: true,
        },
      });
      savedHomeHot = parseShopOrderedFeaturedProductIds(
        featuredRow?.homeHotCarouselFeaturedProductIds ?? null,
        { max: HOME_HOT_CAROUSEL_MAX_ITEMS },
      );
      permanentPopular = parseShopOrderedFeaturedProductIds(
        featuredRow?.popularItemsFeaturedProductIds ?? null,
        { max: HOME_HOT_CAROUSEL_MAX_ITEMS },
      );
      permanentFeaturedShops = parseShopOrderedFeaturedProductIds(
        featuredRow?.browseShopsPageFeaturedShopIds ?? null,
        { max: SHOPS_BROWSE_PAGE_FEATURED_MAX_ITEMS },
      );
    }
  } catch (e) {
    console.error("[admin-promotion-lists] featured ids load", e);
  }

  const platformHomeHotCarouselInitialIds = mergeAdminFeaturedOrder(
    savedHomeHot,
    activeHomeHot,
    HOME_HOT_CAROUSEL_MAX_ITEMS,
  );

  const [homeHotLabelsByProductId, popularLabelsByProductId, permanentFeaturedShopOptions, activeShopRows] =
    await Promise.all([
      loadFeaturedProductLabelsForIds(platformHomeHotCarouselInitialIds),
      loadFeaturedProductLabelsForIds([...new Set([...activePopular, ...permanentPopular])]),
      prisma.shop.findMany({
        where: CREATOR_SHOP_BASE,
        select: { id: true, displayName: true, slug: true },
        orderBy: { displayName: "asc" },
      }),
      activeFeaturedShops.length > 0
        ? prisma.shop.findMany({
            where: { id: { in: activeFeaturedShops }, ...CREATOR_SHOP_BASE },
            select: { id: true, displayName: true, slug: true },
          })
        : Promise.resolve([]),
    ]);

  const activeFeaturedShopLabelsById: Record<string, string> = {};
  for (const s of activeShopRows) {
    activeFeaturedShopLabelsById[s.id] = `${s.displayName} — /${s.slug}`;
  }

  return {
    platformHomeHotCarouselInitialIds,
    homeHotLabelsByProductId,
    activePopularProductIds: activePopular,
    permanentPopularProductIds: permanentPopular,
    popularLabelsByProductId,
    activeFeaturedShopIds: activeFeaturedShops,
    permanentFeaturedShopIds: permanentFeaturedShops,
    permanentFeaturedShopOptions,
    activeFeaturedShopLabelsById,
  };
}

function setLabel(labels: Record<string, string>, id: string, label: string) {
  const trimmed = label.trim();
  if (trimmed && !labels[id]) labels[id] = trimmed;
}

/** Resolve human-readable item names for admin featured-id lists. */
async function loadFeaturedProductLabelsForIds(
  productIds: string[],
): Promise<Record<string, string>> {
  if (productIds.length === 0) return {};
  const labels: Record<string, string> = {};
  const unresolved = new Set(productIds);

  const liveRows = await prisma.shopListing.findMany({
    where: {
      productId: { in: productIds },
      ...marketplaceAggregatedListingWhere,
    },
    select: {
      productId: true,
      requestItemName: true,
      product: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  for (const r of liveRows) {
    if (labels[r.productId]) continue;
    setLabel(labels, r.productId, r.requestItemName?.trim() || r.product.name);
    unresolved.delete(r.productId);
  }

  if (unresolved.size > 0) {
    const anyListingRows = await prisma.shopListing.findMany({
      where: { productId: { in: [...unresolved] } },
      select: {
        productId: true,
        requestItemName: true,
        product: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    for (const r of anyListingRows) {
      if (labels[r.productId]) continue;
      setLabel(labels, r.productId, r.requestItemName?.trim() || r.product.name);
      unresolved.delete(r.productId);
    }
  }

  if (unresolved.size > 0) {
    const listingIdRows = await prisma.shopListing.findMany({
      where: { id: { in: [...unresolved] } },
      select: {
        id: true,
        productId: true,
        requestItemName: true,
        product: { select: { name: true } },
      },
    });
    for (const r of listingIdRows) {
      const label = r.requestItemName?.trim() || r.product.name;
      setLabel(labels, r.id, label);
      setLabel(labels, r.productId, label);
      unresolved.delete(r.id);
      unresolved.delete(r.productId);
    }
  }

  if (unresolved.size > 0) {
    const printifyRows = await prisma.shopListing.findMany({
      where: { listingPrintifyProductId: { in: [...unresolved] } },
      select: {
        listingPrintifyProductId: true,
        productId: true,
        requestItemName: true,
        product: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    for (const r of printifyRows) {
      if (!r.listingPrintifyProductId) continue;
      const label = r.requestItemName?.trim() || r.product.name;
      setLabel(labels, r.listingPrintifyProductId, label);
      setLabel(labels, r.productId, label);
      unresolved.delete(r.listingPrintifyProductId);
      unresolved.delete(r.productId);
    }
  }

  if (unresolved.size > 0) {
    const products = await prisma.product.findMany({
      where: { id: { in: [...unresolved] } },
      select: { id: true, name: true },
    });
    for (const p of products) {
      setLabel(labels, p.id, p.name);
      unresolved.delete(p.id);
    }
  }

  return labels;
}

async function loadPermanentFeaturedProductPickerUncached(): Promise<AdminFeaturedProductPickerPayload> {
  const liveRows = await prisma.shopListing.findMany({
    where: {
      ...marketplaceAggregatedListingWhere,
      product: { active: true },
    },
    select: {
      shopId: true,
      productId: true,
      requestItemName: true,
      product: { select: { name: true } },
      shop: { select: { displayName: true } },
    },
    orderBy: { product: { name: "asc" } },
    take: 500,
  });

  const byShop = new Map<string, { productId: string; label: string }[]>();
  const shopDisplayNameById = new Map<string, string>();
  const labelsByProductId: Record<string, string> = {};

  for (const r of liveRows) {
    shopDisplayNameById.set(r.shopId, r.shop.displayName);
    const itemLabel = r.requestItemName?.trim() || r.product.name;
    const list = byShop.get(r.shopId) ?? [];
    if (list.some((x) => x.productId === r.productId)) continue;
    list.push({ productId: r.productId, label: itemLabel });
    byShop.set(r.shopId, list);
    labelsByProductId[r.productId] = itemLabel;
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

/** Cached active-placement picklist — Hot items tab. */
export function loadAdminFeaturedProductPicker(kind: PromotionKind) {
  return unstable_cache(
    () => loadActivePromotionListingPicker(kind),
    [`admin-active-promotion-picker:v2:${kind}`],
    { revalidate: PICKER_CACHE_S },
  )();
}

/** Cached live listing picklist — permanent Popular items editor. */
export const loadAdminPermanentFeaturedProductPicker = unstable_cache(
  loadPermanentFeaturedProductPickerUncached,
  ["admin-permanent-featured-picker:v1"],
  { revalidate: PICKER_CACHE_S },
);
