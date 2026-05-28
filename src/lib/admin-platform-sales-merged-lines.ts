import type { PrismaClient } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import {
  ListingCreditPackPurchaseStatus,
  OrderStatus,
  PromotionKind,
  PromotionPurchaseStatus,
} from "@/generated/prisma/enums";
import { listingCreditPackById } from "@/lib/listing-credit-packs";
import { listingFeeCentsForOrdinal } from "@/lib/marketplace-constants";
import { promotionKindLabel } from "@/lib/promotions";

const orderLineInclude = {
  order: { select: { id: true, createdAt: true } },
  shop: { select: { displayName: true, slug: true } },
  shopListing: { select: { requestItemName: true } },
} as const;

function orderLineDisplayName(l: AdminPlatformSalesOrderLineRow): string {
  const item = l.shopListing?.requestItemName?.trim();
  if (item) return item;
  return l.productName;
}

export type AdminPlatformSalesOrderLineRow = Prisma.OrderLineGetPayload<{
  include: typeof orderLineInclude;
}>;

/** Row filters: publication fee vs merchandise order lines vs promotion purchases. */
export type AdminPlatformSaleCategory = "listing" | "item" | "support" | "promotion";

export type AdminPlatformSalesMergedLine =
  | {
      kind: "merchandise";
      platformSaleCategory: "item";
      id: string;
      quantity: number;
      unitPriceCents: number;
      productName: string;
      goodsServicesCostCents: number;
      platformCutCents: number;
      shopCutCents: number;
      order: { id: string; createdAt: Date };
      shop: { displayName: string; slug: string } | null;
    }
  | {
      kind: "listing_publication_fee";
      platformSaleCategory: "listing";
      id: string;
      quantity: number;
      unitPriceCents: number;
      productName: string;
      goodsServicesCostCents: number;
      platformCutCents: number;
      shopCutCents: number;
      order: { id: string; createdAt: Date };
      shop: { displayName: string; slug: string } | null;
    }
  | {
      kind: "listing_credit_pack_purchase";
      platformSaleCategory: "listing";
      id: string;
      quantity: number;
      unitPriceCents: number;
      productName: string;
      goodsServicesCostCents: number;
      platformCutCents: number;
      shopCutCents: number;
      order: { id: string; createdAt: Date };
      shop: { displayName: string; slug: string } | null;
    }
  | {
      kind: "support_tip";
      platformSaleCategory: "support";
      id: string;
      quantity: number;
      unitPriceCents: number;
      productName: string;
      goodsServicesCostCents: number;
      platformCutCents: number;
      shopCutCents: number;
      order: { id: string; createdAt: Date };
      shop: null;
    }
  | {
      kind: "promotion_purchase";
      platformSaleCategory: "promotion";
      id: string;
      quantity: number;
      unitPriceCents: number;
      productName: string;
      goodsServicesCostCents: number;
      platformCutCents: number;
      shopCutCents: number;
      order: { id: string; createdAt: Date };
      shop: { displayName: string; slug: string } | null;
    };

type ListingFeeRow = {
  id: string;
  shopId: string;
  listingFeePaidAt: Date;
  listingPublicationFeePaidCents: number | null;
  requestItemName: string | null;
  shop: { displayName: string; slug: string; listingFeeBonusFreeSlots: number };
};

function listingFeePaidAtWhere(
  salesOrderCreatedAt: { gte?: Date; lte?: Date } | undefined,
): Prisma.DateTimeNullableFilter {
  const notNull: Prisma.DateTimeNullableFilter = { not: null };
  if (!salesOrderCreatedAt) return notNull;
  return {
    not: null,
    ...(salesOrderCreatedAt.gte ? { gte: salesOrderCreatedAt.gte } : {}),
    ...(salesOrderCreatedAt.lte ? { lte: salesOrderCreatedAt.lte } : {}),
  };
}

function promotionPaidAtWhere(
  salesOrderCreatedAt: { gte?: Date; lte?: Date } | undefined,
): Prisma.DateTimeNullableFilter {
  const notNull: Prisma.DateTimeNullableFilter = { not: null };
  if (!salesOrderCreatedAt) return notNull;
  return {
    not: null,
    ...(salesOrderCreatedAt.gte ? { gte: salesOrderCreatedAt.gte } : {}),
    ...(salesOrderCreatedAt.lte ? { lte: salesOrderCreatedAt.lte } : {}),
  };
}

function listingCreditPackMergedLabel(packId: string): string {
  const pack = listingCreditPackById(packId);
  return pack ? `Listing credits — ${pack.label}` : "Listing credits — pack purchase";
}

function promotionMergedLabel(kind: PromotionKind, listingName: string | null): string {
  const k = promotionKindLabel(kind);
  if (kind === PromotionKind.FEATURED_SHOP_HOME) return `${k} — shop`;
  const ln = listingName?.trim();
  return ln ? `${k} — ${ln}` : `${k} — listing`;
}

function buildOrdinalByListingId(
  rows: { id: string; shopId: string }[],
): Map<string, number> {
  const map = new Map<string, number>();
  let curShop: string | null = null;
  let idx = 0;
  for (const r of rows) {
    if (r.shopId !== curShop) {
      curShop = r.shopId;
      idx = 0;
    }
    idx++;
    map.set(r.id, idx);
  }
  return map;
}

function publicationFeeCentsForListing(
  row: ListingFeeRow,
  ordinalByListingId: Map<string, number>,
): number {
  if (row.listingPublicationFeePaidCents != null) {
    return row.listingPublicationFeePaidCents;
  }
  const ordinal = ordinalByListingId.get(row.id) ?? 1;
  return listingFeeCentsForOrdinal(
    ordinal,
    row.shop.slug,
    Math.max(0, row.shop.listingFeeBonusFreeSlots),
  );
}

/**
 * Same headline counts as {@link loadMergedPlatformSalesLines} for the Platform sales nav badge only.
 * Avoids loading capped order lines / tips / promotion rows when the Sales tab body is not needed.
 */
export async function loadPlatformSalesNavBadgeCounts(
  prisma: PrismaClient,
  opts: { salesOrderCreatedAt?: { gte?: Date; lte?: Date } },
): Promise<{
  orderLineCount: number;
  publicationFeePaymentCount: number;
  promotionPurchaseCount: number;
}> {
  const orderWhere = {
    order: {
      status: OrderStatus.paid,
      ...(opts.salesOrderCreatedAt ? { createdAt: opts.salesOrderCreatedAt } : {}),
    },
  };
  const listingFeePaidFilter = listingFeePaidAtWhere(opts.salesOrderCreatedAt);
  const promotionPaidFilter = promotionPaidAtWhere(opts.salesOrderCreatedAt);

  const [orderLineCount, feeListings, promotionPurchaseCount, listingCreditPackPurchaseCount] =
    await Promise.all([
    prisma.orderLine.count({ where: orderWhere }),
    prisma.shopListing.findMany({
      where: { listingFeePaidAt: listingFeePaidFilter },
      select: {
        id: true,
        shopId: true,
        listingFeePaidAt: true,
        listingPublicationFeePaidCents: true,
        requestItemName: true,
        shop: {
          select: {
            displayName: true,
            slug: true,
            listingFeeBonusFreeSlots: true,
          },
        },
      },
    }),
    prisma.promotionPurchase.count({
      where: {
        status: PromotionPurchaseStatus.paid,
        paidAt: promotionPaidFilter,
      },
    }),
    (async () => {
      try {
        return await prisma.listingCreditPackPurchase.count({
          where: {
            status: ListingCreditPackPurchaseStatus.paid,
            paidAt: promotionPaidFilter,
          },
        });
      } catch (e) {
        console.error(
          "[loadPlatformSalesNavBadgeCounts] listingCreditPackPurchase count failed (migration pending?)",
          e,
        );
        return 0;
      }
    })(),
  ]);

  const shopIds = [...new Set(feeListings.map((l) => l.shopId))];
  const ordinalRows =
    shopIds.length === 0
      ? []
      : await prisma.shopListing.findMany({
          where: { shopId: { in: shopIds } },
          orderBy: [{ shopId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          select: { id: true, shopId: true },
        });
  const ordinalByListingId = buildOrdinalByListingId(ordinalRows);

  let publicationFeePaymentCount = 0;
  for (const row of feeListings) {
    if (!row.listingFeePaidAt) continue;
    if (row.listingPublicationFeePaidCents === 0) continue;
    const feeCents = publicationFeeCentsForListing(
      {
        id: row.id,
        shopId: row.shopId,
        listingFeePaidAt: row.listingFeePaidAt,
        listingPublicationFeePaidCents: row.listingPublicationFeePaidCents,
        requestItemName: row.requestItemName,
        shop: {
          displayName: row.shop.displayName,
          slug: row.shop.slug,
          listingFeeBonusFreeSlots: row.shop.listingFeeBonusFreeSlots ?? 0,
        },
      },
      ordinalByListingId,
    );
    if (feeCents > 0) publicationFeePaymentCount++;
  }

  return {
    orderLineCount,
    publicationFeePaymentCount:
      publicationFeePaymentCount + listingCreditPackPurchaseCount,
    promotionPurchaseCount,
  };
}

/**
 * Paid merchandise order lines plus listing publication fees plus promotion purchases (Stripe / mock).
 * Platform sales tab. Merged newest-first (cap 500 rows).
 */
export async function loadMergedPlatformSalesLines(
  prisma: PrismaClient,
  opts: { salesOrderCreatedAt?: { gte?: Date; lte?: Date } },
): Promise<{
  lines: AdminPlatformSalesMergedLine[];
  orderLineCount: number;
  publicationFeePaymentCount: number;
  supportTipCount: number;
  promotionPurchaseCount: number;
}> {
  const orderWhere = {
    order: {
      status: OrderStatus.paid,
      ...(opts.salesOrderCreatedAt ? { createdAt: opts.salesOrderCreatedAt } : {}),
    },
  };

  const listingFeePaidFilter = listingFeePaidAtWhere(opts.salesOrderCreatedAt);

  const supportTipWhere = opts.salesOrderCreatedAt ? { createdAt: opts.salesOrderCreatedAt } : {};

  const promotionPaidFilter = promotionPaidAtWhere(opts.salesOrderCreatedAt);

  const [
    orderLinesRaw,
    orderLineCount,
    feeListings,
    supportTips,
    supportTipCount,
    promotionRows,
    listingCreditPackRows,
  ] = await Promise.all([
    prisma.orderLine.findMany({
      where: orderWhere,
      orderBy: { order: { createdAt: "desc" } },
      take: 500,
      include: orderLineInclude,
    }),
    prisma.orderLine.count({ where: orderWhere }),
    prisma.shopListing.findMany({
      where: { listingFeePaidAt: listingFeePaidFilter },
      select: {
        id: true,
        shopId: true,
        listingFeePaidAt: true,
        listingPublicationFeePaidCents: true,
        requestItemName: true,
        shop: {
          select: {
            displayName: true,
            slug: true,
            listingFeeBonusFreeSlots: true,
          },
        },
      },
    }),
    prisma.supportTip.findMany({
      where: supportTipWhere,
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, amountCents: true, createdAt: true },
    }),
    prisma.supportTip.count({ where: supportTipWhere }),
    prisma.promotionPurchase.findMany({
      where: {
        status: PromotionPurchaseStatus.paid,
        paidAt: promotionPaidFilter,
      },
      orderBy: { paidAt: "desc" },
      take: 500,
      select: {
        id: true,
        kind: true,
        amountCents: true,
        paidAt: true,
        shop: { select: { displayName: true, slug: true } },
        shopListing: { select: { requestItemName: true } },
      },
    }),
    prisma.listingCreditPackPurchase.findMany({
      where: {
        status: ListingCreditPackPurchaseStatus.paid,
        paidAt: promotionPaidFilter,
      },
      orderBy: { paidAt: "desc" },
      take: 500,
      select: {
        id: true,
        packId: true,
        amountCents: true,
        paidAt: true,
        shop: { select: { displayName: true, slug: true } },
      },
    }),
  ]);

  const orderLines = orderLinesRaw as AdminPlatformSalesOrderLineRow[];

  const shopIds = [...new Set(feeListings.map((l) => l.shopId))];
  const ordinalRows =
    shopIds.length === 0
      ? []
      : await prisma.shopListing.findMany({
          where: { shopId: { in: shopIds } },
          orderBy: [{ shopId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          select: { id: true, shopId: true },
        });
  const ordinalByListingId = buildOrdinalByListingId(ordinalRows);

  const feeLines: AdminPlatformSalesMergedLine[] = [];
  let publicationFeePaymentCount = 0;
  for (const row of feeListings) {
    if (!row.listingFeePaidAt) continue;
    /** Free-slot waiver: do not show as a paid publication in platform sales. */
    if (row.listingPublicationFeePaidCents === 0) continue;
    const feeCents = publicationFeeCentsForListing(
      {
        ...row,
        listingFeePaidAt: row.listingFeePaidAt,
        shop: {
          displayName: row.shop.displayName,
          slug: row.shop.slug,
          listingFeeBonusFreeSlots: row.shop.listingFeeBonusFreeSlots ?? 0,
        },
      },
      ordinalByListingId,
    );
    if (feeCents <= 0) continue;
    publicationFeePaymentCount++;
    const label = row.requestItemName?.trim()
      ? `Listing publication fee — ${row.requestItemName.trim()}`
      : "Listing publication fee";
    feeLines.push({
      kind: "listing_publication_fee",
      platformSaleCategory: "listing",
      id: `listing_publication_fee:${row.id}`,
      quantity: 1,
      unitPriceCents: feeCents,
      productName: label,
      goodsServicesCostCents: 0,
      platformCutCents: feeCents,
      shopCutCents: 0,
      order: {
        id: `listing_publication_fee:${row.id}`,
        createdAt: row.listingFeePaidAt,
      },
      shop: {
        displayName: row.shop.displayName,
        slug: row.shop.slug,
      },
    });
  }

  const merchLines: AdminPlatformSalesMergedLine[] = orderLines.map((l) => ({
    kind: "merchandise" as const,
    platformSaleCategory: "item" as const,
    id: l.id,
    quantity: l.quantity,
    unitPriceCents: l.unitPriceCents,
    productName: orderLineDisplayName(l),
    goodsServicesCostCents: l.goodsServicesCostCents,
    platformCutCents: l.platformCutCents,
    shopCutCents: l.shopCutCents,
    order: { id: l.order.id, createdAt: l.order.createdAt },
    shop: l.shop,
  }));

  const supportLines: AdminPlatformSalesMergedLine[] = supportTips.map((t) => ({
    kind: "support_tip" as const,
    platformSaleCategory: "support" as const,
    id: `support_tip:${t.id}`,
    quantity: 1,
    unitPriceCents: t.amountCents,
    productName: "Support tip",
    goodsServicesCostCents: 0,
    platformCutCents: t.amountCents,
    shopCutCents: 0,
    order: { id: `support_tip:${t.id}`, createdAt: t.createdAt },
    shop: null,
  }));

  const promotionLines: AdminPlatformSalesMergedLine[] = promotionRows
    .filter((row): row is typeof row & { paidAt: Date } => row.paidAt != null)
    .map((row) => ({
      kind: "promotion_purchase" as const,
      platformSaleCategory: "promotion" as const,
      id: `promotion_purchase:${row.id}`,
      quantity: 1,
      unitPriceCents: row.amountCents,
      productName: promotionMergedLabel(
        row.kind,
        row.shopListing?.requestItemName ?? null,
      ),
      goodsServicesCostCents: 0,
      platformCutCents: row.amountCents,
      shopCutCents: 0,
      order: {
        id: `promotion_purchase:${row.id}`,
        createdAt: row.paidAt,
      },
      shop: {
        displayName: row.shop.displayName,
        slug: row.shop.slug,
      },
    }));

  const listingCreditPackLines: AdminPlatformSalesMergedLine[] = listingCreditPackRows
    .filter((row): row is typeof row & { paidAt: Date } => row.paidAt != null)
    .map((row) => ({
      kind: "listing_credit_pack_purchase" as const,
      platformSaleCategory: "listing" as const,
      id: `listing_credit_pack_purchase:${row.id}`,
      quantity: 1,
      unitPriceCents: row.amountCents,
      productName: listingCreditPackMergedLabel(row.packId),
      goodsServicesCostCents: 0,
      platformCutCents: row.amountCents,
      shopCutCents: 0,
      order: {
        id: `listing_credit_pack_purchase:${row.id}`,
        createdAt: row.paidAt,
      },
      shop: {
        displayName: row.shop.displayName,
        slug: row.shop.slug,
      },
    }));

  const merged = [
    ...merchLines,
    ...feeLines,
    ...listingCreditPackLines,
    ...supportLines,
    ...promotionLines,
  ].sort(
    (a, b) => b.order.createdAt.getTime() - a.order.createdAt.getTime(),
  );
  const lines = merged.slice(0, 500);

  return {
    lines,
    orderLineCount,
    publicationFeePaymentCount,
    supportTipCount,
    promotionPurchaseCount: promotionLines.length,
  };
}

/** Jan 1 00:00:00.000 UTC of `year` through `end` (inclusive window for `lte`). */
export function utcYearToDateRange(year: number, end: Date): { gte: Date; lte: Date } {
  const gte = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  return { gte, lte: end };
}

/** Full UTC calendar year: Jan 1 00:00:00.000 through Dec 31 23:59:59.999. */
export function utcFullCalendarYearRange(year: number): { gte: Date; lte: Date } {
  return {
    gte: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
    lte: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  };
}

/** First instant of the UTC calendar month containing `through`, through `through` (month-to-date). */
export function utcMonthToDateRangeThrough(through: Date): { gte: Date; lte: Date } {
  const y = through.getUTCFullYear();
  const m = through.getUTCMonth();
  const gte = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  return { gte, lte: through };
}

/** Full previous UTC calendar month relative to `through`’s month. */
export function utcPreviousCalendarMonthRange(through: Date): { gte: Date; lte: Date } {
  const y = through.getUTCFullYear();
  const m = through.getUTCMonth();
  const prevYear = m === 0 ? y - 1 : y;
  const prevMonth = m === 0 ? 11 : m - 1;
  const gte = new Date(Date.UTC(prevYear, prevMonth, 1, 0, 0, 0, 0));
  const lte = new Date(Date.UTC(prevYear, prevMonth + 1, 0, 23, 59, 59, 999));
  return { gte, lte };
}

export type PlatformSalesPeriodTotals = {
  /** Sum of `OrderLine.platformCutCents` for paid orders in the window. */
  itemPlatformCents: number;
  /** Sum of publication fee platform revenue (same rules as merged listing fee rows). */
  listingPlatformCents: number;
  /** Sum of paid promotion placements (merchant dashboard boosts). */
  promotionPlatformCents: number;
  /** Sum of platform support tips (Stripe Checkout sessions). */
  supportPlatformCents: number;
};

export type PlatformSalesYtdTotals = PlatformSalesPeriodTotals & {
  year: number;
};

/**
 * Platform revenue by category for an arbitrary UTC `[gte, lte]` window.
 * Listing fees use the same waived / ordinal rules as {@link loadMergedPlatformSalesLines}.
 */
export async function aggregatePlatformRevenueForUtcWindow(
  prisma: PrismaClient,
  gte: Date,
  lte: Date,
): Promise<PlatformSalesPeriodTotals> {
  const orderLineSum = await prisma.orderLine.aggregate({
    where: {
      order: {
        status: OrderStatus.paid,
        createdAt: { gte, lte },
      },
    },
    _sum: { platformCutCents: true },
  });

  const listingFeePaidFilter: Prisma.DateTimeNullableFilter = {
    not: null,
    gte,
    lte,
  };

  const feeListings = await prisma.shopListing.findMany({
    where: { listingFeePaidAt: listingFeePaidFilter },
    select: {
      id: true,
      shopId: true,
      listingFeePaidAt: true,
      listingPublicationFeePaidCents: true,
      shop: {
        select: {
          slug: true,
          listingFeeBonusFreeSlots: true,
        },
      },
    },
  });

  const shopIds = [...new Set(feeListings.map((l) => l.shopId))];
  const ordinalRows =
    shopIds.length === 0
      ? []
      : await prisma.shopListing.findMany({
          where: { shopId: { in: shopIds } },
          orderBy: [{ shopId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          select: { id: true, shopId: true },
        });
  const ordinalByListingId = buildOrdinalByListingId(ordinalRows);

  let listingPlatformCents = 0;
  for (const row of feeListings) {
    if (!row.listingFeePaidAt) continue;
    if (row.listingPublicationFeePaidCents === 0) continue;
    const feeCents = publicationFeeCentsForListing(
      {
        id: row.id,
        shopId: row.shopId,
        listingFeePaidAt: row.listingFeePaidAt,
        listingPublicationFeePaidCents: row.listingPublicationFeePaidCents,
        requestItemName: null,
        shop: {
          displayName: "",
          slug: row.shop.slug,
          listingFeeBonusFreeSlots: row.shop.listingFeeBonusFreeSlots ?? 0,
        },
      },
      ordinalByListingId,
    );
    if (feeCents > 0) listingPlatformCents += feeCents;
  }

  const supportTipSum = await prisma.supportTip.aggregate({
    where: { createdAt: { gte, lte } },
    _sum: { amountCents: true },
  });

  const promotionPurchaseSum = await prisma.promotionPurchase.aggregate({
    where: {
      status: PromotionPurchaseStatus.paid,
      paidAt: { not: null, gte, lte },
    },
    _sum: { amountCents: true },
  });

  const listingCreditPackSum = await prisma.listingCreditPackPurchase.aggregate({
    where: {
      status: ListingCreditPackPurchaseStatus.paid,
      paidAt: { not: null, gte, lte },
    },
    _sum: { amountCents: true },
  });

  return {
    itemPlatformCents: orderLineSum._sum.platformCutCents ?? 0,
    listingPlatformCents: listingPlatformCents + (listingCreditPackSum._sum.amountCents ?? 0),
    promotionPlatformCents: promotionPurchaseSum._sum.amountCents ?? 0,
    supportPlatformCents: supportTipSum._sum.amountCents ?? 0,
  };
}

/** UTC calendar month containing `through`, from the first of that month through `through`. */
export async function loadPlatformSalesCurrentMonthTotals(
  prisma: PrismaClient,
  through: Date,
): Promise<PlatformSalesPeriodTotals> {
  const { gte, lte } = utcMonthToDateRangeThrough(through);
  return aggregatePlatformRevenueForUtcWindow(prisma, gte, lte);
}

/** Full UTC calendar month immediately before the month containing `through`. */
export async function loadPlatformSalesPreviousMonthTotals(
  prisma: PrismaClient,
  through: Date,
): Promise<PlatformSalesPeriodTotals> {
  const { gte, lte } = utcPreviousCalendarMonthRange(through);
  return aggregatePlatformRevenueForUtcWindow(prisma, gte, lte);
}

/**
 * Year-to-date platform revenue by sale category (UTC calendar year through `through`).
 */
export async function loadPlatformSalesYtdTotals(
  prisma: PrismaClient,
  through: Date,
): Promise<PlatformSalesYtdTotals> {
  const year = through.getUTCFullYear();
  const { gte, lte } = utcYearToDateRange(year, through);
  const totals = await aggregatePlatformRevenueForUtcWindow(prisma, gte, lte);
  return { year, ...totals };
}

/**
 * Full prior UTC calendar year relative to `through` (e.g. when `through` is in 2026, aggregates 2025 Jan–Dec).
 */
export async function loadPlatformSalesPriorCalendarYearTotals(
  prisma: PrismaClient,
  through: Date,
): Promise<PlatformSalesYtdTotals> {
  const year = through.getUTCFullYear() - 1;
  const { gte, lte } = utcFullCalendarYearRange(year);
  const totals = await aggregatePlatformRevenueForUtcWindow(prisma, gte, lte);
  return { year, ...totals };
}
