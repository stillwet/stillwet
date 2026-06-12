import { unstable_cache } from "next/cache";
import { prisma, prismaAdminInboundEmailOrNull } from "@/lib/prisma";
import {
  ListingRequestStatus,
  PromotionKind,
  PromotionPurchaseStatus,
} from "@/generated/prisma/enums";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { supportUnresolvedThreadShopIdsExcludingPlatform } from "@/lib/support-thread-unresolved";
import type { Prisma } from "@/generated/prisma/client";
import { isPaidPromotionActiveNow } from "@/lib/promotion-policy-shared";
import { loadPlatformSalesNavBadgeCounts } from "@/lib/admin-platform-sales-merged-lines";

const TWO_HOURS_S = 60 * 60 * 2;

async function computeListingRequestTabBadgeCountUncached() {
  return prisma.shopListing.count({
    where: {
      removedFromListingRequestsAt: null,
      requestStatus: {
        in: [
          ListingRequestStatus.submitted,
          ListingRequestStatus.images_ok,
          ListingRequestStatus.printify_item_created,
        ],
      },
    },
  });
}

/**
 * Cached admin nav badge loaders (staggered 2h windows to avoid herd refresh).
 * Listing requests is prioritized (shortest window / earliest refresh).
 */
export const loadAdminBadgeListingRequests = unstable_cache(
  async () => computeListingRequestTabBadgeCountUncached(),
  ["admin-badge:listing-requests:v1"],
  { revalidate: TWO_HOURS_S },
);

export const loadAdminBadgeSupplementPending = unstable_cache(
  async () =>
    prisma.shopListing.count({
      where: {
        ownerSupplementPendingImageUrl: { not: null },
        requestStatus: ListingRequestStatus.approved,
        creatorRemovedFromShopAt: null,
        adminRemovedFromShopAt: null,
        shop: { slug: { not: PLATFORM_SHOP_SLUG } },
      },
    }),
  ["admin-badge:supplement-pending:v1"],
  { revalidate: TWO_HOURS_S + 7 * 60 },
);

export const loadAdminBadgeShopWatch = unstable_cache(
  async () =>
    prisma.shop.count({
      where: {
        slug: { not: PLATFORM_SHOP_SLUG },
        listings: {
          some: {
            OR: [
              { adminRemovedFromShopAt: { not: null } },
              { creatorRemovedFromShopAt: { not: null } },
            ],
          },
        },
      },
    }),
  ["admin-badge:shop-watch:v1"],
  { revalidate: TWO_HOURS_S + 31 * 60 },
);

/**
 * Shop ids needing attention — cached once per TTL. Shared by the nav badge count and the Support
 * tab body so opening Support does not re-run the same SQL after Tier 1 badges already loaded it.
 */
export const loadSupportUnresolvedShopIdsForAdmin = unstable_cache(
  async () => [...(await supportUnresolvedThreadShopIdsExcludingPlatform())],
  ["admin-support-unresolved-shop-ids:v1"],
  { revalidate: TWO_HOURS_S + 13 * 60 },
);

export async function loadAdminBadgeSupportUnresolved() {
  return (await loadSupportUnresolvedShopIdsForAdmin()).length;
}

export const loadAdminBadgeBugFeedbackOpen = unstable_cache(
  async () => prisma.bugFeedbackReport.count({ where: { resolvedAt: null } }),
  ["admin-badge:bug-feedback-open:v1"],
  { revalidate: TWO_HOURS_S + 25 * 60 },
);

export const loadAdminBadgeInboxCount = unstable_cache(
  async () => {
    const d = prismaAdminInboundEmailOrNull();
    if (!d) return 0;
    return await d.count({ where: { repliedAt: null } });
  },
  ["admin-badge:admin-inbox:v2"],
  { revalidate: TWO_HOURS_S + 19 * 60 },
);

export const loadAdminBadgePlatformSales = unstable_cache(
  async () => {
    const platformSalesBadgeSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const salesBadgeCounts = await loadPlatformSalesNavBadgeCounts(prisma, {
      salesOrderCreatedAt: { gte: platformSalesBadgeSince },
    });
    return (
      salesBadgeCounts.itemsSoldCount +
      salesBadgeCounts.listingCreditPackPurchaseCount +
      salesBadgeCounts.promotionPurchaseCount
    );
  },
  ["admin-badge:platform-sales:v1"],
  { revalidate: TWO_HOURS_S + 37 * 60 },
);

export const loadAdminBadgePromotionLists = unstable_cache(
  async () => {
    const placementPromosForBadgeWhere: Prisma.PromotionPurchaseWhereInput = {
      status: PromotionPurchaseStatus.paid,
      paidAt: { not: null },
      kind: {
        in: [
          PromotionKind.FRONT_PAGE_ITEM,
          PromotionKind.HOT_FEATURED_ITEM,
          PromotionKind.MOST_POPULAR_OF_TAG_ITEM,
          PromotionKind.FEATURED_SHOP_HOME,
        ],
      },
    };
    const placementPromosForBadgeSelect = {
      status: true,
      paidAt: true,
      eligibleFrom: true,
    } satisfies Prisma.PromotionPurchaseSelect;
    const placementPromosForBadge = await prisma.promotionPurchase.findMany({
      where: placementPromosForBadgeWhere,
      select: placementPromosForBadgeSelect,
    });
    return placementPromosForBadge.filter((p) => isPaidPromotionActiveNow(p)).length;
  },
  ["admin-badge:promotion-lists:v1"],
  { revalidate: TWO_HOURS_S + 43 * 60 },
);

export const loadAdminBadgeShopLeaderboardCount = unstable_cache(
  async () => {
    const shopLeaderboardShopCountBlock = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint AS c FROM (
        SELECT ol."shopId"
        FROM "OrderLine" ol
        INNER JOIN "Order" o ON o.id = ol."orderId"
        WHERE o.status = 'paid'
          AND ol."shopId" IS NOT NULL
        GROUP BY ol."shopId"
        HAVING SUM(ol.quantity * ol."unitPriceCents") > 0
      ) t
    `;
    return shopLeaderboardShopCountBlock[0]?.c != null ? Number(shopLeaderboardShopCountBlock[0].c) : 0;
  },
  ["admin-badge:shop-leaderboard-count:v1"],
  { revalidate: TWO_HOURS_S + 49 * 60 },
);

export type AdminMainNavBadgeCounts = {
  listingRequests: number;
  supplementPending: number;
  supportUnresolved: number;
  adminInbox: number;
  bugFeedbackOpen: number;
  shopWatch: number;
  promotionLists: number;
  shopLeaderboard: number;
  platformSales: number;
};

/** Cached boolean — avoids `findFirst` on every admin main shell render. */
export const loadAdminHasProducts = unstable_cache(
  async () => (await prisma.product.findFirst({ select: { id: true } })) != null,
  ["admin-has-products:v1"],
  { revalidate: TWO_HOURS_S },
);

/** All main admin nav badge counts in one parallel round-trip (each loader is separately cached). */
export async function loadAdminMainNavBadgeCounts(): Promise<AdminMainNavBadgeCounts> {
  const [
    listingRequests,
    supplementPending,
    supportUnresolved,
    adminInbox,
    bugFeedbackOpen,
    shopWatch,
    promotionLists,
    shopLeaderboard,
    platformSales,
  ] = await Promise.all([
    loadAdminBadgeListingRequests(),
    loadAdminBadgeSupplementPending(),
    loadAdminBadgeSupportUnresolved(),
    loadAdminBadgeInboxCount(),
    loadAdminBadgeBugFeedbackOpen(),
    loadAdminBadgeShopWatch(),
    loadAdminBadgePromotionLists(),
    loadAdminBadgeShopLeaderboardCount(),
    loadAdminBadgePlatformSales(),
  ]);

  return {
    listingRequests,
    supplementPending,
    supportUnresolved,
    adminInbox,
    bugFeedbackOpen,
    shopWatch,
    promotionLists,
    shopLeaderboard,
    platformSales,
  };
}

