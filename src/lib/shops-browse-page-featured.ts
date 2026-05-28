import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import {
  SHOPS_BROWSE_PAGE_FEATURED_DEFAULT_DISPLAY,
  SHOPS_BROWSE_PAGE_FEATURED_MAX_ITEMS,
} from "@/lib/platform-all-page-featured-constants";
import { parseShopOrderedFeaturedProductIds } from "@/lib/shop-ordered-featured-product-ids";
import type { FeaturedCarouselItem } from "@/lib/shop-featured-carousel";
import { shopsToFeaturedCarouselItems } from "@/lib/shop-featured-carousel";
import { getFeaturedShopsRankedRowsFromSnapshot } from "@/lib/platform-featured-shops-snapshot";
import {
  computeFeaturedShopsRankedRows,
  CREATOR_SHOP_BASE,
  toFeaturedRow,
  type ShopBrowseFeaturedRow,
} from "@/lib/shops-browse-page-featured-compute";

export type { ShopBrowseFeaturedRow };

/** Home footer “Featured shops” carousel length (see ranking + pin rules in module doc). */
export const HOME_FEATURED_SHOPS_CAROUSEL_LIMIT = 25;

/**
 * Home “Featured shops” ordering — prefers daily snapshot; falls back to live ranking.
 */
export async function getFeaturedShopsRankedRows(
  limit: number,
): Promise<ShopBrowseFeaturedRow[]> {
  const snap = await getFeaturedShopsRankedRowsFromSnapshot(limit);
  if (snap && snap.length > 0) return snap;
  return computeFeaturedShopsRankedRows(limit);
}

/**
 * Featured shops carousel for the platform home footer — Top-shop promotion order, calendar-month sales,
 * views, and production pin slots.
 */
export async function getHomeFeaturedShopsCarouselItems(): Promise<FeaturedCarouselItem[]> {
  const rows = await getFeaturedShopsRankedRows(HOME_FEATURED_SHOPS_CAROUSEL_LIMIT);
  return shopsToFeaturedCarouselItems(rows, { limit: HOME_FEATURED_SHOPS_CAROUSEL_LIMIT });
}

/**
 * `/shops` featured strip: optional manual ordering from platform shop JSON (`browseShopsPageFeaturedShopIds`);
 * otherwise same ranking as {@link getFeaturedShopsRankedRows} (paid Featured shop home placements first,
 * then calendar-month sales, views, pins).
 */
export async function getShopsBrowsePageFeaturedCarouselShops(
  limit = SHOPS_BROWSE_PAGE_FEATURED_DEFAULT_DISPLAY,
): Promise<ShopBrowseFeaturedRow[]> {
  const platform = await prisma.shop.findUnique({
    where: { slug: PLATFORM_SHOP_SLUG },
    select: { browseShopsPageFeaturedShopIds: true },
  });
  const adminShopIds = parseShopOrderedFeaturedProductIds(
    platform?.browseShopsPageFeaturedShopIds ?? null,
    { max: SHOPS_BROWSE_PAGE_FEATURED_MAX_ITEMS },
  );

  if (adminShopIds.length > 0) {
    const manualCap = Math.min(Math.max(limit, adminShopIds.length), SHOPS_BROWSE_PAGE_FEATURED_MAX_ITEMS);
    const rows = await prisma.shop.findMany({
      where: {
        id: { in: adminShopIds },
        ...CREATOR_SHOP_BASE,
      },
      select: {
        id: true,
        slug: true,
        displayName: true,
        profileImageUrl: true,
        bio: true,
        totalSalesCents: true,
      },
    });
    const byId = new Map(rows.map((r) => [r.id, toFeaturedRow(r)]));
    const out: ShopBrowseFeaturedRow[] = [];
    for (const id of adminShopIds) {
      if (out.length >= manualCap) break;
      const row = byId.get(id);
      if (row) out.push(row);
    }
    return out;
  }

  return getFeaturedShopsRankedRows(limit);
}
