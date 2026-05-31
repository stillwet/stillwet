import { prisma } from "@/lib/prisma";
import { ListingRequestStatus, OrderStatus } from "@/generated/prisma/enums";
import type {
  ShopWatchDetail,
  ShopWatchMarketplaceStats,
  ShopWatchRow,
} from "@/components/admin/AdminShopWatchTab";
import {
  isFounderUnlimitedFreeListingsShop,
  listingFeeCentsForOrdinal,
  PLATFORM_SHOP_SLUG,
  SPECIAL_PROMOTION_FREE_LISTING_IDS,
} from "@/lib/marketplace-constants";
import {
  listingRejectionReasonTextForCard,
  resolveListingRejectionNoticeBody,
} from "@/lib/shop-listing-rejection-notice";
import { listingRejectionNoticeDetail } from "@/lib/listing-request-reject-reasons";
import { listingOrdinalByListingId } from "@/lib/shop-listing-ordinal";

type ListingRow = {
  id: string;
  shopId: string;
  createdAt: Date;
  listingFeePaidAt: Date | null;
  active: boolean;
  requestStatus: ListingRequestStatus;
  requestItemName: string | null;
  adminRemovedFromShopAt: Date | null;
  creatorRemovedFromShopAt: Date | null;
  removedFromListingRequestsAt: Date | null;
  adminListingRemovalNotes: string | null;
  product: { name: string; slug: string; active: boolean };
};

type ShopMeta = {
  id: string;
  displayName: string;
  slug: string;
  listingFeeBonusFreeSlots: number | null;
};

function sortDetails(a: ShopWatchDetail, b: ShopWatchDetail): number {
  return a.productName.localeCompare(b.productName, undefined, { sensitivity: "base" });
}

function listingFeeKindForShopWatch(
  shopSlug: string,
  ordinal1Based: number,
  listingId: string,
  listingFeePaidAt: Date | null,
  listingFeeBonusFreeSlots: number,
): ShopWatchDetail["listingFeeKind"] {
  if (SPECIAL_PROMOTION_FREE_LISTING_IDS.has(listingId)) return "free_promo";
  const cents = listingFeeCentsForOrdinal(ordinal1Based, shopSlug, listingFeeBonusFreeSlots);
  if (cents === 0) {
    return isFounderUnlimitedFreeListingsShop(shopSlug) ? "free_promo" : "free_slot";
  }
  return listingFeePaidAt != null ? "paid" : "unpaid";
}

function emptyDetails(): Pick<
  ShopWatchRow,
  | "detailsActive"
  | "detailsFrozen"
  | "detailsRemoved"
  | "detailsOtherRequested"
  | "detailsOtherPipeline"
  | "detailsOtherApproved"
  | "detailsOtherRejected"
> {
  return {
    detailsActive: [],
    detailsFrozen: [],
    detailsRemoved: [],
    detailsOtherRequested: [],
    detailsOtherPipeline: [],
    detailsOtherApproved: [],
    detailsOtherRejected: [],
  };
}

function buildShopWatchRowFromListings(
  shop: ShopMeta,
  listings: ListingRow[],
  shopRejectionNotices: Array<{ kind: string; relatedListingId: string | null; body: string }>,
  salesCount: number,
): ShopWatchRow {
  const ordinalByListingId = new Map<string, number>();
  [...listings]
    .sort((a, b) => {
      const t = a.createdAt.getTime() - b.createdAt.getTime();
      if (t !== 0) return t;
      return a.id.localeCompare(b.id);
    })
    .forEach((row, i) => ordinalByListingId.set(row.id, i + 1));

  const detailsActiveRaw: ShopWatchDetail[] = [];
  const detailsFrozenRaw: ShopWatchDetail[] = [];
  const detailsRemovedRaw: ShopWatchDetail[] = [];
  const detailsOtherPipelineRaw: ShopWatchDetail[] = [];
  const detailsOtherRequestedRaw: ShopWatchDetail[] = [];
  const detailsOtherApprovedRaw: ShopWatchDetail[] = [];
  const detailsOtherRejectedRaw: ShopWatchDetail[] = [];

  let frozenCount = 0;
  let liveActiveCount = 0;

  for (const l of listings) {
    const ordinal = ordinalByListingId.get(l.id) ?? 1;
    const listingFeeKind = listingFeeKindForShopWatch(
      shop.slug,
      ordinal,
      l.id,
      l.listingFeePaidAt,
      shop.listingFeeBonusFreeSlots ?? 0,
    );
    const base: Omit<ShopWatchDetail, "rowKind"> = {
      listingId: l.id,
      productName: l.product.name,
      productSlug: l.product.slug,
      listingFeeKind,
      queueRemoved: l.removedFromListingRequestsAt != null,
      notes: l.adminListingRemovalNotes,
    };

    if (l.creatorRemovedFromShopAt != null) {
      detailsRemovedRaw.push({ ...base, rowKind: "removed", removalSource: "creator" });
    } else if (l.adminRemovedFromShopAt != null) {
      frozenCount++;
      detailsFrozenRaw.push({ ...base, rowKind: "frozen" });
    } else if (l.active && l.creatorRemovedFromShopAt == null && l.product.active) {
      liveActiveCount++;
      detailsActiveRaw.push({ ...base, rowKind: "active" });
    } else if (
      l.removedFromListingRequestsAt != null &&
      l.creatorRemovedFromShopAt == null &&
      l.adminRemovedFromShopAt == null
    ) {
      detailsRemovedRaw.push({
        ...base,
        rowKind: "removed",
        removalSource: "admin_queue",
        rejectionReasonText: listingRejectionNoticeDetail("other", null),
      });
    } else {
      const row: ShopWatchDetail = {
        ...base,
        rowKind: "other",
        pipelineStatus: l.requestStatus,
        listingActive: l.active,
        productActive: l.product.active,
      };
      if (l.requestStatus === ListingRequestStatus.rejected) {
        const noticeBody = resolveListingRejectionNoticeBody(
          shopRejectionNotices,
          l.id,
          l.product.name,
        );
        detailsOtherRejectedRaw.push({
          ...row,
          rejectionReasonText: listingRejectionReasonTextForCard(noticeBody),
        });
      } else if (l.requestStatus === ListingRequestStatus.approved) {
        detailsOtherApprovedRaw.push(row);
      } else if (
        l.requestStatus === ListingRequestStatus.submitted ||
        l.requestStatus === ListingRequestStatus.images_ok
      ) {
        detailsOtherRequestedRaw.push(row);
      } else {
        detailsOtherPipelineRaw.push(row);
      }
    }
  }

  detailsActiveRaw.sort(sortDetails);
  detailsFrozenRaw.sort(sortDetails);
  detailsRemovedRaw.sort(sortDetails);
  detailsOtherRequestedRaw.sort(sortDetails);
  detailsOtherPipelineRaw.sort(sortDetails);
  detailsOtherApprovedRaw.sort(sortDetails);
  detailsOtherRejectedRaw.sort(sortDetails);

  const paidListingsCount = listings.reduce((acc, l) => {
    const ordinal = ordinalByListingId.get(l.id) ?? 1;
    return listingFeeKindForShopWatch(
      shop.slug,
      ordinal,
      l.id,
      l.listingFeePaidAt,
      shop.listingFeeBonusFreeSlots ?? 0,
    ) === "paid"
      ? acc + 1
      : acc;
  }, 0);

  return {
    shopId: shop.id,
    displayName: shop.displayName,
    slug: shop.slug,
    activeListingsCount: liveActiveCount + detailsOtherApprovedRaw.length,
    salesCount,
    paidListingsCount,
    frozenCount,
    removedCount: detailsRemovedRaw.length + detailsOtherRejectedRaw.length,
    detailsActive: detailsActiveRaw,
    detailsFrozen: detailsFrozenRaw,
    detailsRemoved: detailsRemovedRaw,
    detailsOtherRequested: detailsOtherRequestedRaw,
    detailsOtherPipeline: detailsOtherPipelineRaw,
    detailsOtherApproved: detailsOtherApprovedRaw,
    detailsOtherRejected: detailsOtherRejectedRaw,
  };
}

const listingSelect = {
  id: true,
  shopId: true,
  createdAt: true,
  listingFeePaidAt: true,
  active: true,
  requestStatus: true,
  requestItemName: true,
  adminRemovedFromShopAt: true,
  creatorRemovedFromShopAt: true,
  removedFromListingRequestsAt: true,
  adminListingRemovalNotes: true,
  product: { select: { name: true, slug: true, active: true } },
} as const;

/** Table rows with counts only — listing details load on expand. */
export async function loadAdminShopWatchSummaryRows(): Promise<ShopWatchRow[]> {
  const creatorShops = await prisma.shop.findMany({
    where: { slug: { not: PLATFORM_SHOP_SLUG }, active: true },
    select: {
      id: true,
      displayName: true,
      slug: true,
      listingFeeBonusFreeSlots: true,
    },
    orderBy: { displayName: "asc" },
  });
  if (creatorShops.length === 0) return [];

  const shopIds = creatorShops.map((s) => s.id);

  const [salesGrouped, aggregateRowsFixed, paidOrdinalRows] = await Promise.all([
    prisma.order.groupBy({
      by: ["shopId"],
      where: { shopId: { in: shopIds }, status: OrderStatus.paid },
      _count: { _all: true },
    }),
    prisma.$queryRaw<
    Array<{
      shopId: string;
      frozenCount: number;
      liveActiveCount: number;
      approvedNotLiveCount: number;
      removedCreatorCount: number;
      queueRemovedCount: number;
      rejectedCount: number;
      requestedCount: number;
      pipelineCount: number;
    }>
  >`
    SELECT
      l."shopId" AS "shopId",
      COUNT(*) FILTER (WHERE l."adminRemovedFromShopAt" IS NOT NULL)::int AS "frozenCount",
      COUNT(*) FILTER (
        WHERE l.active = true
          AND l."creatorRemovedFromShopAt" IS NULL
          AND l."adminRemovedFromShopAt" IS NULL
          AND p.active = true
      )::int AS "liveActiveCount",
      COUNT(*) FILTER (
        WHERE l."requestStatus" = ${ListingRequestStatus.approved}::"ListingRequestStatus"
          AND NOT (
            l.active = true
            AND l."creatorRemovedFromShopAt" IS NULL
            AND l."adminRemovedFromShopAt" IS NULL
            AND p.active = true
          )
      )::int AS "approvedNotLiveCount",
      COUNT(*) FILTER (WHERE l."creatorRemovedFromShopAt" IS NOT NULL)::int AS "removedCreatorCount",
      COUNT(*) FILTER (
        WHERE l."removedFromListingRequestsAt" IS NOT NULL
          AND l."creatorRemovedFromShopAt" IS NULL
          AND l."adminRemovedFromShopAt" IS NULL
      )::int AS "queueRemovedCount",
      COUNT(*) FILTER (
        WHERE l."requestStatus" = ${ListingRequestStatus.rejected}::"ListingRequestStatus"
          AND l."creatorRemovedFromShopAt" IS NULL
          AND l."adminRemovedFromShopAt" IS NULL
          AND l."removedFromListingRequestsAt" IS NULL
      )::int AS "rejectedCount",
      COUNT(*) FILTER (
        WHERE l."requestStatus" IN (
          ${ListingRequestStatus.submitted}::"ListingRequestStatus",
          ${ListingRequestStatus.images_ok}::"ListingRequestStatus"
        )
      )::int AS "requestedCount",
      COUNT(*) FILTER (
        WHERE l."requestStatus" NOT IN (
          ${ListingRequestStatus.approved}::"ListingRequestStatus",
          ${ListingRequestStatus.rejected}::"ListingRequestStatus",
          ${ListingRequestStatus.submitted}::"ListingRequestStatus",
          ${ListingRequestStatus.images_ok}::"ListingRequestStatus"
        )
          AND l."creatorRemovedFromShopAt" IS NULL
          AND l."adminRemovedFromShopAt" IS NULL
          AND l."removedFromListingRequestsAt" IS NULL
      )::int AS "pipelineCount"
    FROM "ShopListing" l
    INNER JOIN "Product" p ON p.id = l."productId"
    WHERE l."shopId" = ANY(${shopIds}::text[])
    GROUP BY l."shopId"
  `,
    prisma.shopListing.findMany({
      where: { shopId: { in: shopIds }, listingFeePaidAt: { not: null } },
      select: {
        id: true,
        shopId: true,
        listingFeePaidAt: true,
        listingPublicationFeePaidCents: true,
      },
    }),
  ]);

  const salesByShop = new Map(
    salesGrouped.map((r) => [r.shopId!, r._count._all]),
  );
  const aggByShop = new Map(aggregateRowsFixed.map((r) => [r.shopId, r]));

  const shopMetaById = new Map(creatorShops.map((s) => [s.id, s]));
  const paidIds = paidOrdinalRows.map((r) => r.id);
  const ordinalByListingId = await listingOrdinalByListingId(prisma, paidIds);

  const paidCountByShop = new Map<string, number>();
  for (const row of paidOrdinalRows) {
    const shop = shopMetaById.get(row.shopId);
    if (!shop || !row.listingFeePaidAt) continue;
    if (row.listingPublicationFeePaidCents === 0) continue;
    const ordinal = ordinalByListingId.get(row.id) ?? 1;
    const kind = listingFeeKindForShopWatch(
      shop.slug,
      ordinal,
      row.id,
      row.listingFeePaidAt,
      shop.listingFeeBonusFreeSlots ?? 0,
    );
    if (kind === "paid") {
      paidCountByShop.set(row.shopId, (paidCountByShop.get(row.shopId) ?? 0) + 1);
    }
  }

  const rows: ShopWatchRow[] = creatorShops.map((shop) => {
    const agg = aggByShop.get(shop.id);
    const removedCount =
      (agg?.removedCreatorCount ?? 0) + (agg?.queueRemovedCount ?? 0) + (agg?.rejectedCount ?? 0);
    return {
      shopId: shop.id,
      displayName: shop.displayName,
      slug: shop.slug,
      activeListingsCount: (agg?.liveActiveCount ?? 0) + (agg?.approvedNotLiveCount ?? 0),
      salesCount: salesByShop.get(shop.id) ?? 0,
      paidListingsCount: paidCountByShop.get(shop.id) ?? 0,
      frozenCount: agg?.frozenCount ?? 0,
      removedCount,
      otherRequestedCount: agg?.requestedCount ?? 0,
      otherPipelineCount: agg?.pipelineCount ?? 0,
      ...emptyDetails(),
    };
  });

  rows.sort(
    (a, b) =>
      b.frozenCount + b.removedCount - (a.frozenCount + a.removedCount) ||
      a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
  );

  return rows;
}

/** Full listing details for one shop (expand row). */
export async function loadAdminShopWatchShopDetails(
  shopId: string,
): Promise<Pick<
  ShopWatchRow,
  | "detailsActive"
  | "detailsFrozen"
  | "detailsRemoved"
  | "detailsOtherRequested"
  | "detailsOtherPipeline"
  | "detailsOtherApproved"
  | "detailsOtherRejected"
> | null> {
  const shop = await prisma.shop.findFirst({
    where: { id: shopId, slug: { not: PLATFORM_SHOP_SLUG }, active: true },
    select: {
      id: true,
      displayName: true,
      slug: true,
      listingFeeBonusFreeSlots: true,
    },
  });
  if (!shop) return null;

  const [listings, listingRejectionNotices, salesCount] = await Promise.all([
    prisma.shopListing.findMany({
      where: { shopId: shop.id },
      select: listingSelect,
    }),
    prisma.shopOwnerNotice.findMany({
      where: { shopId: shop.id, kind: "listing_rejected" },
      orderBy: { createdAt: "desc" },
      select: { shopId: true, kind: true, relatedListingId: true, body: true },
    }),
    prisma.order.count({
      where: { shopId: shop.id, status: OrderStatus.paid },
    }),
  ]);

  const full = buildShopWatchRowFromListings(shop, listings, listingRejectionNotices, salesCount);
  return {
    detailsActive: full.detailsActive,
    detailsFrozen: full.detailsFrozen,
    detailsRemoved: full.detailsRemoved,
    detailsOtherRequested: full.detailsOtherRequested,
    detailsOtherPipeline: full.detailsOtherPipeline,
    detailsOtherApproved: full.detailsOtherApproved,
    detailsOtherRejected: full.detailsOtherRejected,
  };
}

export async function loadAdminShopWatchMarketplaceStats(): Promise<ShopWatchMarketplaceStats> {
  const [creatorAccountCount, shopsWithListingCount, shopsWithPaidListingCount] = await Promise.all([
    prisma.shopUser.count({
      where: { shop: { slug: { not: PLATFORM_SHOP_SLUG } } },
    }),
    prisma.shop.count({
      where: {
        slug: { not: PLATFORM_SHOP_SLUG },
        listings: { some: {} },
      },
    }),
    prisma.shop.count({
      where: {
        slug: { not: PLATFORM_SHOP_SLUG },
        listings: { some: { listingFeePaidAt: { not: null } } },
      },
    }),
  ]);
  return { creatorAccountCount, shopsWithListingCount, shopsWithPaidListingCount };
}
