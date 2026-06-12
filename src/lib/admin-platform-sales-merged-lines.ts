import { unstable_cache } from "next/cache";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  AdminPlatformSaleCategory,
  AdminPlatformSalesMergedLine,
} from "@/lib/admin-platform-sales-merged-line-model";
import { CREATOR_GIFT_LISTING_SPLIT_LABEL } from "@/lib/admin-platform-sales-merged-line-model";
export type {
  AdminPlatformSalesBuyer,
  AdminPlatformSaleCategory,
  AdminPlatformSalesMergedLine,
} from "@/lib/admin-platform-sales-merged-line-model";
export {
  CREATOR_GIFT_LISTING_SPLIT_LABEL,
  isCreatorGiftListingSplitProfitOnlyLine,
  isPlatformCheckoutMergedLine,
  mergedLineCheckoutPaidCents,
  mergedLinePaidCogsStripeNetCents,
  mergedLineStripeBalanceFeeCents,
  mergedLineTransactionPartyLabel,
  platformCheckoutFullChargeCents,
} from "@/lib/admin-platform-sales-merged-line-model";
import {
  CreatorGiftPurchaseStatus,
  ListingCreditPackPurchaseStatus,
  OrderStatus,
  PromotionKind,
  PromotionPurchaseStatus,
  ShopFlairPurchaseStatus,
  ShopGoogleShoppingPurchaseStatus,
  ShopReactivationPurchaseStatus,
  ShopSetupFeePurchaseStatus,
} from "@/generated/prisma/enums";
import { listingCreditPackById } from "@/lib/listing-credit-packs";
import { productHref } from "@/lib/marketplace-constants";
import { SHOP_SETUP_FEE_CENTS, SHOP_SETUP_FEE_LABEL } from "@/lib/creator-gift-codes";
import { SHOP_REACTIVATION_FEE_CENTS, SHOP_REACTIVATION_FEE_LABEL } from "@/lib/shop-inactivity-policy";
import { checkoutTipProcessingSurchargeCents } from "@/lib/checkout-tip";
import {
  promotionGrantsFromPurchase,
  promotionGrantsTotalCredits,
  promotionGrantsDistinctKindCount,
} from "@/lib/creator-gift-promotion-grants";
import { googleShoppingCreditPackById } from "@/lib/google-shopping-credit-packs";
import { promotionKindLabel } from "@/lib/promotions";
import {
  aggregateShopUpgradesPlatformRevenue,
  creatorGiftListingMerchandiseCents,
  creatorGiftNonListingShopUpgradeMerchandiseCents,
  listingCreditPackPurchaseMerchandiseCents,
  promotionPurchaseMerchandiseCents,
  shopFlairPurchaseMerchandiseCents,
  shopGoogleShoppingPurchaseMerchandiseCents,
  type CreatorGiftShopUpgradeRevenueRow,
} from "@/lib/admin-platform-shop-upgrades-revenue";
import {
  buyerCheckoutTotalCents,
  stripeBalanceProcessingFeeCents,
} from "@/lib/stripe-card-processing-fee";
import { supportTipMerchandiseCents } from "@/lib/support-site";

const orderLineInclude = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      email: true,
      shippingState: true,
      shippingCountry: true,
      subtotalCents: true,
      tipCents: true,
      shippingCents: true,
      totalCents: true,
      stripePaymentIntentId: true,
    },
  },
  shop: { select: { displayName: true, slug: true } },
  shopListing: { select: { requestItemName: true } },
  product: { select: { slug: true } },
} as const;

function orderLineDisplayName(l: AdminPlatformSalesOrderLineRow): string {
  const item = l.shopListing?.requestItemName?.trim();
  if (item) return item;
  return l.productName;
}

export type AdminPlatformSalesOrderLineRow = Prisma.OrderLineGetPayload<{
  include: typeof orderLineInclude;
}>;

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
  if (!pack) return "Listing credits — pack purchase";
  const creditWord = pack.credits === 1 ? "credit" : "credits";
  return `Listing credits — ${pack.credits} ${creditWord}`;
}

function promotionMergedLabel(kind: PromotionKind, listingName: string | null): string {
  const k = promotionKindLabel(kind);
  if (kind === PromotionKind.FEATURED_SHOP_HOME) return `${k} — shop`;
  const ln = listingName?.trim();
  return ln ? `${k} — ${ln}` : `${k} — listing`;
}

function googleShoppingMergedLabel(packId: string): string {
  const pack = googleShoppingCreditPackById(packId);
  return pack ? `Google Shopping — ${pack.label}` : "Google Shopping credits";
}

const CREATOR_GIFT_MULTIPLE_PROMO_CREDITS_LABEL = "Gift - Multiple Promo Credits";

function creatorGiftPromotionPartCount(row: CreatorGiftShopUpgradeRevenueRow): number {
  let count = 0;
  if (promotionGrantsFromPurchase(row).length > 0) count += 1;
  if (row.googleShoppingCreditsGranted > 0 || row.googleShoppingCreditPackId) count += 1;
  if (row.shopFlairIncluded) count += 1;
  return count;
}

/** Purchased units on creator-gift promotion rows (credits + one per pack/flair add-on). */
function creatorGiftPromotionSegmentQuantity(row: CreatorGiftShopUpgradeRevenueRow): number {
  let qty = promotionGrantsTotalCredits(promotionGrantsFromPurchase(row));
  if (row.googleShoppingCreditPackId || row.googleShoppingCreditsGranted > 0) {
    qty += 1;
  }
  if (row.shopFlairIncluded) qty += 1;
  return qty;
}

function creatorGiftListingLabel(row: CreatorGiftShopUpgradeRevenueRow): string {
  const pack = row.listingCreditPackId ? listingCreditPackById(row.listingCreditPackId) : null;
  const credits = pack?.credits ?? row.listingCreditsGranted;
  if (credits > 0) return `Gift - Listings - ${credits} Credits`;
  return "Gift - Listings";
}

function creatorGiftPromotionLabel(row: CreatorGiftShopUpgradeRevenueRow): string {
  const promotionGrants = promotionGrantsFromPurchase(row);
  const partCount = creatorGiftPromotionPartCount(row);
  if (partCount > 1) return CREATOR_GIFT_MULTIPLE_PROMO_CREDITS_LABEL;
  if (partCount === 0) return "Gift - Promotions";
  if (promotionGrants.length > 0) {
    if (promotionGrantsDistinctKindCount(promotionGrants) > 1) {
      return CREATOR_GIFT_MULTIPLE_PROMO_CREDITS_LABEL;
    }
    return `Gift - Promotions - ${promotionKindLabel(promotionGrants[0]!.kind)}`;
  }
  if (row.shopFlairIncluded) return "Gift - Shop Flair";
  return "Gift - Google Shopping";
}

function creatorGiftMergedLineProductName(
  row: CreatorGiftShopUpgradeRevenueRow,
  seg: { category: AdminPlatformSaleCategory; label: string },
): string {
  if (
    seg.category === "promotion" &&
    (creatorGiftPromotionPartCount(row) > 1 ||
      promotionGrantsDistinctKindCount(promotionGrantsFromPurchase(row)) > 1)
  ) {
    return CREATOR_GIFT_MULTIPLE_PROMO_CREDITS_LABEL;
  }
  return seg.label;
}

function allocateCheckoutStripeFeeCents(
  checkoutTotalCents: number,
  totalMerchandiseCents: number,
  segmentMerchandiseCents: number,
): number {
  if (checkoutTotalCents <= 0 || totalMerchandiseCents <= 0 || segmentMerchandiseCents <= 0) {
    return 0;
  }
  const totalFee = stripeBalanceProcessingFeeCents(checkoutTotalCents);
  return Math.round((totalFee * segmentMerchandiseCents) / totalMerchandiseCents);
}

function platformCheckoutMergedLine<K extends AdminPlatformSalesMergedLine["kind"]>(
  kind: K,
  platformSaleCategory: AdminPlatformSaleCategory,
  params: {
    id: string;
    productName: string;
    checkoutTotalCents: number;
    merchandiseCents: number;
    paidAt: Date;
    shop: { displayName: string; slug: string } | null;
    itemHref: string | null;
    stripeFeeCents?: number;
    transactionEmail?: string | null;
    orderNumber?: number | null;
    creatorGiftSplitPart?: "listing" | "promotion";
    quantity?: number;
  },
): Extract<AdminPlatformSalesMergedLine, { kind: K }> {
  const merchandiseCents = Math.max(0, params.merchandiseCents);
  const checkoutTotalCents = (() => {
    const stored = Math.max(0, params.checkoutTotalCents);
    if (merchandiseCents <= 0) return stored;
    if (stored === merchandiseCents) return buyerCheckoutTotalCents(merchandiseCents);
    return stored;
  })();
  const stripeFeeCents =
    params.stripeFeeCents ?? stripeBalanceProcessingFeeCents(checkoutTotalCents);
  return {
    kind,
    platformSaleCategory,
    id: params.id,
    quantity: Math.max(1, params.quantity ?? 1),
    unitPriceCents: checkoutTotalCents,
    productName: params.productName,
    checkoutTotalCents,
    itemPriceCents: params.merchandiseCents,
    tipCents: 0,
    goodsServicesCostCents: 0,
    productionFeeCents: 0,
    /** Platform merchandise revenue (excludes buyer Stripe pass-through in the adjacent column). */
    platformCutCents: params.merchandiseCents,
    shopCutCents: 0,
    stripeFeeCents,
    tipProcessingFeeCents: 0,
    order: {
      id: params.id,
      createdAt: params.paidAt,
      orderNumber: params.orderNumber ?? null,
    },
    shop: params.shop,
    transactionEmail: params.transactionEmail ?? null,
    itemHref: params.itemHref,
    ...(params.creatorGiftSplitPart ? { creatorGiftSplitPart: params.creatorGiftSplitPart } : {}),
  } as Extract<AdminPlatformSalesMergedLine, { kind: K }>;
}

type CreatorGiftPurchaseMergedRow = CreatorGiftShopUpgradeRevenueRow & {
  id: string;
  amountCents: number;
  paidAt: Date | null;
  transactionNumber: number | null;
  purchaserEmail: string | null;
  setupFeeIncluded: boolean;
  isBetaTesterBatch: boolean;
  isWaivedShopFeeBatch: boolean;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  recipientShop: { displayName: string; slug: string } | null;
};

function creatorGiftPurchaseToMergedLines(row: CreatorGiftPurchaseMergedRow): AdminPlatformSalesMergedLine[] {
  if (row.paidAt == null || row.amountCents <= 0) return [];

  const segments: {
    category: AdminPlatformSaleCategory;
    label: string;
    merchandiseCents: number;
    quantity: number;
  }[] = [];

  if (
    countsTowardShopCreationRevenue({
      source: "creator_gift",
      status: "paid",
      amountCents: row.amountCents,
      setupFeeIncluded: row.setupFeeIncluded,
      isBetaTesterBatch: row.isBetaTesterBatch,
      isWaivedShopFeeBatch: row.isWaivedShopFeeBatch,
      stripeCheckoutSessionId: row.stripeCheckoutSessionId,
      stripePaymentIntentId: row.stripePaymentIntentId,
    })
  ) {
    segments.push({
      category: "shop_creation",
      label: "Gift - Shop Setup",
      merchandiseCents: SHOP_SETUP_FEE_CENTS,
      quantity: 1,
    });
  }

  const listingMerch = creatorGiftListingMerchandiseCents(row);
  if (listingMerch > 0) {
    segments.push({
      category: "listing",
      label: creatorGiftListingLabel(row),
      merchandiseCents: listingMerch,
      quantity: 1,
    });
  }

  const promotionMerch = creatorGiftNonListingShopUpgradeMerchandiseCents(row);
  if (promotionMerch > 0) {
    segments.push({
      category: "promotion",
      label: creatorGiftPromotionLabel(row),
      merchandiseCents: promotionMerch,
      quantity: creatorGiftPromotionSegmentQuantity(row),
    });
  }

  if (segments.length === 0) return [];

  const totalMerch = segments.reduce((sum, seg) => sum + seg.merchandiseCents, 0);
  const shop = row.recipientShop;
  const hasListingPromotionSplit =
    segments.some((seg) => seg.category === "listing") &&
    segments.some((seg) => seg.category === "promotion");
  const fullStripeFeeCents = stripeBalanceProcessingFeeCents(row.amountCents);

  return segments.map((seg) => {
    const isSingle = segments.length === 1;

    if (hasListingPromotionSplit && seg.category === "promotion") {
      return platformCheckoutMergedLine("creator_gift_purchase", seg.category, {
        id: `creator_gift_purchase:${row.id}:${seg.category}`,
        productName: creatorGiftMergedLineProductName(row, seg),
        checkoutTotalCents: row.amountCents,
        merchandiseCents: seg.merchandiseCents,
        paidAt: row.paidAt!,
        shop,
        itemHref: null,
        stripeFeeCents: fullStripeFeeCents,
        transactionEmail: row.purchaserEmail,
        orderNumber: row.transactionNumber,
        creatorGiftSplitPart: "promotion",
        quantity: seg.quantity,
      });
    }

    if (hasListingPromotionSplit && seg.category === "listing") {
      return platformCheckoutMergedLine("creator_gift_purchase", seg.category, {
        id: `creator_gift_purchase:${row.id}:${seg.category}`,
        productName: CREATOR_GIFT_LISTING_SPLIT_LABEL,
        checkoutTotalCents: 0,
        merchandiseCents: seg.merchandiseCents,
        paidAt: row.paidAt!,
        shop,
        itemHref: null,
        stripeFeeCents: 0,
        transactionEmail: row.purchaserEmail,
        orderNumber: row.transactionNumber,
        creatorGiftSplitPart: "listing",
        quantity: seg.quantity,
      });
    }

    const checkoutTotalCents = isSingle
      ? row.amountCents
      : Math.round((row.amountCents * seg.merchandiseCents) / totalMerch);
    const stripeFeeCents = isSingle
      ? fullStripeFeeCents
      : allocateCheckoutStripeFeeCents(row.amountCents, totalMerch, seg.merchandiseCents);

    return platformCheckoutMergedLine("creator_gift_purchase", seg.category, {
      id: `creator_gift_purchase:${row.id}:${seg.category}`,
      productName: creatorGiftMergedLineProductName(row, seg),
      checkoutTotalCents,
      merchandiseCents: seg.merchandiseCents,
      paidAt: row.paidAt!,
      shop,
      itemHref: null,
      stripeFeeCents,
      transactionEmail: row.purchaserEmail,
      orderNumber: row.transactionNumber,
      quantity: seg.quantity,
    });
  });
}

/** @internal Exported for unit tests. */
export function buildCreatorGiftPurchaseMergedLines(
  row: CreatorGiftPurchaseMergedRow,
): AdminPlatformSalesMergedLine[] {
  return creatorGiftPurchaseToMergedLines(row);
}

/**
 * Same headline counts as {@link loadMergedPlatformSalesLines} for the Platform sales nav badge only.
 * Avoids loading capped order lines / tips / promotion rows when the Sales tab body is not needed.
 */
export async function loadPlatformSalesNavBadgeCounts(
  prisma: PrismaClient,
  opts: { salesOrderCreatedAt?: { gte?: Date; lte?: Date } },
): Promise<{
  /** Sum of paid merchandise `OrderLine.quantity` (units sold), not order or line row count. */
  itemsSoldCount: number;
  listingCreditPackPurchaseCount: number;
  promotionPurchaseCount: number;
}> {
  const orderWhere = {
    order: {
      status: OrderStatus.paid,
      ...(opts.salesOrderCreatedAt ? { createdAt: opts.salesOrderCreatedAt } : {}),
    },
  };
  const promotionPaidFilter = promotionPaidAtWhere(opts.salesOrderCreatedAt);

  const [itemsSoldAgg, listingCreditPackPurchaseCount, promotionPurchaseCount] = await Promise.all([
    prisma.orderLine.aggregate({
      where: orderWhere,
      _sum: { quantity: true },
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
    prisma.promotionPurchase.count({
      where: {
        status: PromotionPurchaseStatus.paid,
        paidAt: promotionPaidFilter,
      },
    }),
  ]);

  return {
    itemsSoldCount: itemsSoldAgg._sum.quantity ?? 0,
    listingCreditPackPurchaseCount: listingCreditPackPurchaseCount,
    promotionPurchaseCount,
  };
}

/** Buyer merchandise checkout payment-processing line (stored in order total, not order lines). */
export function merchandiseOrderPaymentProcessingCents(order: {
  subtotalCents: number;
  tipCents: number;
  shippingCents: number;
  totalCents: number;
}): number {
  return Math.max(
    0,
    order.totalCents -
      order.subtotalCents -
      Math.max(0, order.tipCents) -
      Math.max(0, order.shippingCents),
  );
}

/** Stripe balance fee (2.9% + 30¢ on full charge) for a paid merchandise order. */
export function merchandiseOrderStripeBalanceFeeCents(order: { totalCents: number }): number {
  return stripeBalanceProcessingFeeCents(order.totalCents);
}

/**
 * Stripe pass-through portion of the payment-processing line (excludes the flat
 * cart-tip platform surcharge, which is tracked as {@link checkoutTipProcessingSurchargeCents}).
 */
export function merchandiseOrderStripePassThroughCents(order: {
  subtotalCents: number;
  tipCents: number;
  shippingCents: number;
  totalCents: number;
}): number {
  const processing = merchandiseOrderPaymentProcessingCents(order);
  const tipSurcharge = checkoutTipProcessingSurchargeCents(order.tipCents);
  return Math.max(0, processing - tipSurcharge);
}

/** Flat cart-tip platform surcharge on the buyer payment-processing line (not paid to Stripe). */
export function merchandiseOrderTipProcessingFeeCents(order: {
  tipCents: number;
}): number {
  return checkoutTipProcessingSurchargeCents(order.tipCents);
}

/** Proportional share of an order-level cents field across merchandise lines. */
export function allocateMerchandiseOrderLineShareCents(
  order: { subtotalCents: number },
  lineMerchandiseCents: number,
  orderLevelCents: number,
): number {
  if (orderLevelCents <= 0 || order.subtotalCents <= 0) return 0;
  const lineMerch = Math.max(0, lineMerchandiseCents);
  if (lineMerch <= 0) return 0;
  return Math.round((orderLevelCents * lineMerch) / order.subtotalCents);
}

/** Stripe balance fee (2.9% + 30¢ on full charge) allocated to a merchandise line. */
export function allocateMerchandiseLineStripeBalanceFeeCents(
  order: { subtotalCents: number; totalCents: number },
  lineMerchandiseCents: number,
): number {
  return allocateMerchandiseOrderLineShareCents(
    order,
    lineMerchandiseCents,
    stripeBalanceProcessingFeeCents(order.totalCents),
  );
}

function allocateMerchandiseLineTipProcessingFeeCents(
  order: {
    subtotalCents: number;
    tipCents: number;
  },
  lineMerchandiseCents: number,
): number {
  const orderTipFee = merchandiseOrderTipProcessingFeeCents(order);
  if (orderTipFee <= 0 || order.subtotalCents <= 0) return 0;
  const lineMerch = Math.max(0, lineMerchandiseCents);
  if (lineMerch <= 0) return 0;
  return Math.round((orderTipFee * lineMerch) / order.subtotalCents);
}

/**
 * All paid buyer merchandise lines and platform checkout rows that feed Platform sales summaries.
 * Merged newest-first (cap 500 rows).
 */
export async function loadMergedPlatformSalesLines(
  prisma: PrismaClient,
  opts: { salesOrderCreatedAt?: { gte?: Date; lte?: Date } },
): Promise<{
  lines: AdminPlatformSalesMergedLine[];
  orderLineCount: number;
  listingCreditPackPurchaseCount: number;
  supportTipCount: number;
  promotionPurchaseCount: number;
}> {
  const perSourceCap = 200;
  const orderWhere = {
    order: {
      status: OrderStatus.paid,
      ...(opts.salesOrderCreatedAt ? { createdAt: opts.salesOrderCreatedAt } : {}),
    },
  };

  const supportTipWhere = opts.salesOrderCreatedAt ? { createdAt: opts.salesOrderCreatedAt } : {};
  const paidAtFilter = promotionPaidAtWhere(opts.salesOrderCreatedAt);
  const paidCheckoutWhere = paidShopSetupCheckoutWhere();

  const [
    orderLinesRaw,
    orderLineCount,
    supportTips,
    supportTipCount,
    promotionRows,
    listingCreditPackRows,
    shopSetupRows,
    shopReactivationRows,
    shopFlairRows,
    shopGoogleShoppingRows,
    creatorGiftRows,
  ] = await Promise.all([
    prisma.orderLine.findMany({
      where: orderWhere,
      orderBy: { order: { createdAt: "desc" } },
      take: perSourceCap,
      include: orderLineInclude,
    }),
    prisma.orderLine.count({ where: orderWhere }),
    prisma.supportTip.findMany({
      where: supportTipWhere,
      orderBy: { createdAt: "desc" },
      take: perSourceCap,
      select: { id: true, amountCents: true, createdAt: true, transactionNumber: true },
    }),
    prisma.supportTip.count({ where: supportTipWhere }),
    prisma.promotionPurchase.findMany({
      where: {
        status: PromotionPurchaseStatus.paid,
        paidAt: paidAtFilter,
      },
      orderBy: { paidAt: "desc" },
      take: perSourceCap,
      select: {
        id: true,
        kind: true,
        amountCents: true,
        paidViaPromotionCredit: true,
        paidAt: true,
        transactionNumber: true,
        shop: { select: { displayName: true, slug: true } },
        shopListing: {
          select: {
            requestItemName: true,
            product: { select: { slug: true } },
          },
        },
      },
    }),
    prisma.listingCreditPackPurchase.findMany({
      where: {
        status: ListingCreditPackPurchaseStatus.paid,
        paidAt: paidAtFilter,
      },
      orderBy: { paidAt: "desc" },
      take: perSourceCap,
      select: {
        id: true,
        packId: true,
        amountCents: true,
        paidAt: true,
        transactionNumber: true,
        shop: { select: { displayName: true, slug: true } },
      },
    }),
    prisma.shopSetupFeePurchase.findMany({
      where: {
        status: ShopSetupFeePurchaseStatus.paid,
        paidAt: paidAtFilter,
        ...paidCheckoutWhere,
      },
      orderBy: { paidAt: "desc" },
      take: perSourceCap,
      select: {
        id: true,
        amountCents: true,
        paidAt: true,
        transactionNumber: true,
        shop: { select: { displayName: true, slug: true } },
        pendingSignup: { select: { email: true } },
      },
    }),
    prisma.shopReactivationPurchase.findMany({
      where: {
        status: ShopReactivationPurchaseStatus.paid,
        paidAt: paidAtFilter,
        ...paidCheckoutWhere,
      },
      orderBy: { paidAt: "desc" },
      take: perSourceCap,
      select: {
        id: true,
        amountCents: true,
        paidAt: true,
        transactionNumber: true,
        shop: { select: { displayName: true, slug: true } },
      },
    }),
    prisma.shopFlairPurchase.findMany({
      where: {
        status: ShopFlairPurchaseStatus.paid,
        paidAt: paidAtFilter,
        amountCents: { gt: 0 },
      },
      orderBy: { paidAt: "desc" },
      take: perSourceCap,
      select: {
        id: true,
        amountCents: true,
        paidAt: true,
        transactionNumber: true,
        shop: { select: { displayName: true, slug: true } },
      },
    }),
    prisma.shopGoogleShoppingPurchase.findMany({
      where: {
        status: ShopGoogleShoppingPurchaseStatus.paid,
        paidAt: paidAtFilter,
        amountCents: { gt: 0 },
      },
      orderBy: { paidAt: "desc" },
      take: perSourceCap,
      select: {
        id: true,
        packId: true,
        amountCents: true,
        paidAt: true,
        transactionNumber: true,
        shop: { select: { displayName: true, slug: true } },
      },
    }),
    prisma.creatorGiftPurchase.findMany({
      where: {
        status: CreatorGiftPurchaseStatus.paid,
        paidAt: paidAtFilter,
        ...paidCheckoutWhere,
      },
      orderBy: { paidAt: "desc" },
      take: perSourceCap,
      select: {
        id: true,
        amountCents: true,
        paidAt: true,
        transactionNumber: true,
        setupFeeIncluded: true,
        isBetaTesterBatch: true,
        isWaivedShopFeeBatch: true,
        stripeCheckoutSessionId: true,
        stripePaymentIntentId: true,
        listingCreditPackId: true,
        listingCreditsGranted: true,
        googleShoppingCreditPackId: true,
        googleShoppingCreditsGranted: true,
        promotionKind: true,
        promotionCreditsGranted: true,
        promotionGrants: { select: { kind: true, credits: true } },
        shopFlairIncluded: true,
        purchaserEmail: true,
        recipientShop: { select: { displayName: true, slug: true } },
      },
    }),
  ]);

  const orderLines = orderLinesRaw as AdminPlatformSalesOrderLineRow[];

  const merchLines: AdminPlatformSalesMergedLine[] = orderLines.map((l) => {
    const lineMerch = l.unitPriceCents * l.quantity;
    return {
    kind: "merchandise" as const,
    platformSaleCategory: "item" as const,
    id: l.id,
    quantity: l.quantity,
    unitPriceCents: l.unitPriceCents,
    productName: orderLineDisplayName(l),
    checkoutTotalCents: allocateMerchandiseOrderLineShareCents(
      l.order,
      lineMerch,
      l.order.totalCents,
    ),
    itemPriceCents: lineMerch,
    tipCents: allocateMerchandiseOrderLineShareCents(l.order, lineMerch, l.order.tipCents),
    goodsServicesCostCents: l.goodsServicesCostCents,
    productionFeeCents: mergedLineProductionFeeCents(l),
    platformCutCents: l.platformCutCents,
    shopCutCents: l.shopCutCents,
    stripeFeeCents: allocateMerchandiseLineStripeBalanceFeeCents(l.order, lineMerch),
    tipProcessingFeeCents: allocateMerchandiseLineTipProcessingFeeCents(
      l.order,
      lineMerch,
    ),
    order: {
      id: l.order.id,
      createdAt: l.order.createdAt,
      orderNumber: l.order.orderNumber,
      stripePaymentIntentId: l.order.stripePaymentIntentId,
    },
    shop: l.shop,
    buyer: {
      email: l.order.email,
      shippingState: l.order.shippingState,
      shippingCountry: l.order.shippingCountry,
    },
    itemHref:
      l.shop && l.product.slug ? productHref(l.shop.slug, l.product.slug) : null,
  };
  });

  const supportLines: AdminPlatformSalesMergedLine[] = supportTips.map((t) => {
    const merchandiseCents = supportTipMerchandiseCents(t);
    const checkoutTotalCents = buyerCheckoutTotalCents(merchandiseCents);
    return platformCheckoutMergedLine("support_tip", "support", {
      id: `support_tip:${t.id}`,
      productName: "Support <3",
      checkoutTotalCents,
      merchandiseCents,
      paidAt: t.createdAt,
      shop: null,
      itemHref: null,
      stripeFeeCents: stripeBalanceProcessingFeeCents(checkoutTotalCents),
      orderNumber: t.transactionNumber,
    });
  });

  const promotionLines: AdminPlatformSalesMergedLine[] = promotionRows
    .filter((row): row is typeof row & { paidAt: Date } => row.paidAt != null)
    .map((row) =>
      platformCheckoutMergedLine("promotion_purchase", "promotion", {
        id: `promotion_purchase:${row.id}`,
        productName: promotionMergedLabel(row.kind, row.shopListing?.requestItemName ?? null),
        checkoutTotalCents: row.amountCents,
        merchandiseCents: promotionPurchaseMerchandiseCents(row),
        paidAt: row.paidAt,
        shop: row.shop,
        itemHref:
          row.shopListing?.product.slug != null
            ? productHref(row.shop.slug, row.shopListing.product.slug)
            : null,
        orderNumber: row.transactionNumber,
      }),
    );

  const listingCreditPackLines: AdminPlatformSalesMergedLine[] = listingCreditPackRows
    .filter((row): row is typeof row & { paidAt: Date } => row.paidAt != null)
    .map((row) =>
      platformCheckoutMergedLine("listing_credit_pack_purchase", "listing", {
        id: `listing_credit_pack_purchase:${row.id}`,
        productName: listingCreditPackMergedLabel(row.packId),
        checkoutTotalCents: row.amountCents,
        merchandiseCents: listingCreditPackPurchaseMerchandiseCents(row),
        paidAt: row.paidAt,
        shop: row.shop,
        itemHref: null,
        orderNumber: row.transactionNumber,
      }),
    );

  const shopSetupLines: AdminPlatformSalesMergedLine[] = shopSetupRows
    .filter((row): row is typeof row & { paidAt: Date } => row.paidAt != null)
    .map((row) =>
      platformCheckoutMergedLine("shop_setup_fee_purchase", "shop_creation", {
        id: `shop_setup_fee_purchase:${row.id}`,
        productName: SHOP_SETUP_FEE_LABEL,
        checkoutTotalCents: row.amountCents,
        merchandiseCents: SHOP_SETUP_FEE_CENTS,
        paidAt: row.paidAt,
        shop: row.shop,
        itemHref: null,
        transactionEmail: row.pendingSignup.email,
        orderNumber: row.transactionNumber,
      }),
    );

  const shopReactivationLines: AdminPlatformSalesMergedLine[] = shopReactivationRows
    .filter((row): row is typeof row & { paidAt: Date } => row.paidAt != null)
    .map((row) =>
      platformCheckoutMergedLine("shop_reactivation_purchase", "shop_creation", {
        id: `shop_reactivation_purchase:${row.id}`,
        productName: SHOP_REACTIVATION_FEE_LABEL,
        checkoutTotalCents: row.amountCents,
        merchandiseCents: SHOP_REACTIVATION_FEE_CENTS,
        paidAt: row.paidAt,
        shop: row.shop,
        itemHref: null,
        orderNumber: row.transactionNumber,
      }),
    );

  const shopFlairLines: AdminPlatformSalesMergedLine[] = shopFlairRows
    .filter((row): row is typeof row & { paidAt: Date } => row.paidAt != null)
    .map((row) =>
      platformCheckoutMergedLine("shop_flair_purchase", "promotion", {
        id: `shop_flair_purchase:${row.id}`,
        productName: "Shop Flair",
        checkoutTotalCents: row.amountCents,
        merchandiseCents: shopFlairPurchaseMerchandiseCents(row),
        paidAt: row.paidAt,
        shop: row.shop,
        itemHref: null,
        orderNumber: row.transactionNumber,
      }),
    );

  const shopGoogleShoppingLines: AdminPlatformSalesMergedLine[] = shopGoogleShoppingRows
    .filter((row): row is typeof row & { paidAt: Date } => row.paidAt != null)
    .map((row) =>
      platformCheckoutMergedLine("shop_google_shopping_purchase", "promotion", {
        id: `shop_google_shopping_purchase:${row.id}`,
        productName: googleShoppingMergedLabel(row.packId),
        checkoutTotalCents: row.amountCents,
        merchandiseCents: shopGoogleShoppingPurchaseMerchandiseCents(row),
        paidAt: row.paidAt,
        shop: row.shop,
        itemHref: null,
        orderNumber: row.transactionNumber,
      }),
    );

  const creatorGiftLines = creatorGiftRows.flatMap((row) =>
    creatorGiftPurchaseToMergedLines(row),
  );

  const merged = [
    ...merchLines,
    ...listingCreditPackLines,
    ...shopSetupLines,
    ...shopReactivationLines,
    ...creatorGiftLines,
    ...shopFlairLines,
    ...shopGoogleShoppingLines,
    ...supportLines,
    ...promotionLines,
  ].sort((a, b) => b.order.createdAt.getTime() - a.order.createdAt.getTime());
  const lines = merged.slice(0, 500);

  return {
    lines,
    orderLineCount,
    listingCreditPackPurchaseCount: listingCreditPackLines.length,
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

/** UTC calendar quarter index (0–3) for month `0` = Jan … `11` = Dec. */
export function utcCalendarQuarterIndex(monthIndex: number): 0 | 1 | 2 | 3 {
  return Math.floor(monthIndex / 3) as 0 | 1 | 2 | 3;
}

/** First instant of the UTC calendar quarter containing `through`, through `through` (quarter-to-date). */
export function utcQuarterToDateRangeThrough(through: Date): {
  gte: Date;
  lte: Date;
  quarter: 1 | 2 | 3 | 4;
  year: number;
} {
  const year = through.getUTCFullYear();
  const month = through.getUTCMonth();
  const quarterIndex = utcCalendarQuarterIndex(month);
  const startMonth = quarterIndex * 3;
  const gte = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0));
  return { gte, lte: through, quarter: (quarterIndex + 1) as 1 | 2 | 3 | 4, year };
}

const UTC_QUARTER_MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** e.g. `Q1 2026 (Jan · Feb · Mar)` */
export function platformSalesUtcQuarterTitle(quarter: 1 | 2 | 3 | 4, year: number): string {
  const startMonth = (quarter - 1) * 3;
  const months = UTC_QUARTER_MONTH_ABBR.slice(startMonth, startMonth + 3);
  return `Q${quarter} ${year} (${months.join(" · ")})`;
}

export function platformSalesCurrentUtcQuarterTitle(reference: Date): string {
  const { quarter, year } = utcQuarterToDateRangeThrough(reference);
  return platformSalesUtcQuarterTitle(quarter, year);
}

/** Site launch month for monthly-average platform sales (UTC Jun 2026). */
export const PLATFORM_SALES_MONTHLY_AVERAGE_EPOCH_UTC = { year: 2026, month: 5 } as const;

/** Inclusive UTC calendar months from {@link PLATFORM_SALES_MONTHLY_AVERAGE_EPOCH_UTC} through `through`. */
export function utcMonthsSincePlatformSalesEpochThrough(through: Date): number {
  const { year: epochYear, month: epochMonth } = PLATFORM_SALES_MONTHLY_AVERAGE_EPOCH_UTC;
  const y = through.getUTCFullYear();
  const m = through.getUTCMonth();
  if (y < epochYear || (y === epochYear && m < epochMonth)) return 0;
  return (y - epochYear) * 12 + (m - epochMonth) + 1;
}

export function utcPlatformSalesLifetimeRangeThrough(through: Date): { gte: Date; lte: Date } | null {
  if (utcMonthsSincePlatformSalesEpochThrough(through) <= 0) return null;
  const { year, month } = PLATFORM_SALES_MONTHLY_AVERAGE_EPOCH_UTC;
  return {
    gte: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
    lte: through,
  };
}

export function emptyPlatformSalesPeriodTotals(): PlatformSalesPeriodTotals {
  return {
    itemCheckoutPaidCents: 0,
    itemPlatformCents: 0,
    itemGoodsServicesCents: 0,
    itemShopCutCents: 0,
    itemShopTipCents: 0,
    itemProductionFeeCents: 0,
    itemPlatformMerchandiseTakeCents: 0,
    itemBuyerStripePassThroughCents: 0,
    listingPlatformCents: 0,
    shopCreationPlatformCents: 0,
    promotionPlatformCents: 0,
    supportPlatformCents: 0,
    cartTipPlatformCents: 0,
    platformSalesPaymentProcessingCents: 0,
    shopSalesPaymentProcessingCents: 0,
  };
}

/** Evenly divides each category total by `monthCount` (rounded cents). */
export function averagePlatformSalesPeriodTotals(
  totals: PlatformSalesPeriodTotals,
  monthCount: number,
): PlatformSalesPeriodTotals {
  if (monthCount <= 0) return emptyPlatformSalesPeriodTotals();
  const avg = (n: number) => Math.round(n / monthCount);
  return {
    itemCheckoutPaidCents: avg(totals.itemCheckoutPaidCents),
    itemPlatformCents: avg(totals.itemPlatformCents),
    itemGoodsServicesCents: avg(totals.itemGoodsServicesCents),
    itemShopCutCents: avg(totals.itemShopCutCents),
    itemShopTipCents: avg(totals.itemShopTipCents),
    itemProductionFeeCents: avg(totals.itemProductionFeeCents),
    itemPlatformMerchandiseTakeCents: avg(totals.itemPlatformMerchandiseTakeCents),
    itemBuyerStripePassThroughCents: avg(totals.itemBuyerStripePassThroughCents),
    listingPlatformCents: avg(totals.listingPlatformCents),
    shopCreationPlatformCents: avg(totals.shopCreationPlatformCents),
    promotionPlatformCents: avg(totals.promotionPlatformCents),
    supportPlatformCents: avg(totals.supportPlatformCents),
    cartTipPlatformCents: avg(totals.cartTipPlatformCents),
    platformSalesPaymentProcessingCents: avg(totals.platformSalesPaymentProcessingCents),
    shopSalesPaymentProcessingCents: avg(totals.shopSalesPaymentProcessingCents),
  };
}

export type PlatformSalesMonthlyAverageSummary = {
  monthCount: number;
  totals: PlatformSalesPeriodTotals;
};

export type PlatformSalesPeriodTotals = {
  /** Sum of paid-order `totalCents` (buyer checkout; matches item-row Paid column, pre–sales-tax). */
  itemCheckoutPaidCents: number;
  /** Sum of `OrderLine.platformCutCents` for paid orders in the window. */
  itemPlatformCents: number;
  /** Sum of `OrderLine.goodsServicesCostCents` for paid merchandise in the window. */
  itemGoodsServicesCents: number;
  /** Sum of `OrderLine.shopCutCents` for paid merchandise in the window. */
  itemShopCutCents: number;
  /** Sum of cart `tipCents` on paid merchandise orders in the window (shop tip share). */
  itemShopTipCents: number;
  /** Sum of `OrderLine.productionFeeCents` for paid merchandise in the window. */
  itemProductionFeeCents: number;
  /** Merchandise platform retention (COGS + production fee + platform fee). */
  itemPlatformMerchandiseTakeCents: number;
  /** Buyer Stripe payment-processing pass-through on paid merchandise orders. */
  itemBuyerStripePassThroughCents: number;
  /** Listing credit packs bought on shop upgrades and gifted listing credits. */
  listingPlatformCents: number;
  /** Shop setup and reactivation fee merchandise (self signup, setup gift, or reactivation checkout). */
  shopCreationPlatformCents: number;
  /** Shop upgrades tab (excludes listing credits): placements, flair, Google Shopping, and gifted upgrade credits. */
  promotionPlatformCents: number;
  /** Sum of platform support tips (tip amount only; processing is separate at checkout). */
  supportPlatformCents: number;
  /** Sum of cart tip platform fees (25¢ per tipped order). */
  cartTipPlatformCents: number;
  /** Stripe pass-through on platform checkouts (not paid buyer `Order` rows). */
  platformSalesPaymentProcessingCents: number;
  /** Stripe balance fee on paid `Order` checkouts only (2.9% + 30¢ on full charge; not buyer gross-up). */
  shopSalesPaymentProcessingCents: number;
};

export type PlatformSalesYtdTotals = PlatformSalesPeriodTotals & {
  year: number;
};

/** Shop payout total for period breakdowns: merchandise shop cut + cart tips. */
export function periodShopPayoutCents(
  totals: Pick<PlatformSalesPeriodTotals, "itemShopCutCents" | "itemShopTipCents">,
): number {
  return totals.itemShopCutCents + totals.itemShopTipCents;
}

/** Period Connect application amount: merchandise take + buyer Stripe pass-through. */
export function periodApplicationAmountCents(
  totals: Pick<
    PlatformSalesPeriodTotals,
    "itemPlatformMerchandiseTakeCents" | "itemBuyerStripePassThroughCents"
  >,
): number {
  return totals.itemPlatformMerchandiseTakeCents + totals.itemBuyerStripePassThroughCents;
}

/** Shop sales breakdown header: Paid − Shop payout − COGS − Stripe balance fee. */
export function shopSalesPaidCogsStripeNetCents(
  totals: Pick<
    PlatformSalesPeriodTotals,
    | "itemCheckoutPaidCents"
    | "itemShopCutCents"
    | "itemShopTipCents"
    | "itemGoodsServicesCents"
    | "shopSalesPaymentProcessingCents"
  >,
): number {
  return (
    totals.itemCheckoutPaidCents -
    periodShopPayoutCents(totals) -
    totals.itemGoodsServicesCents -
    totals.shopSalesPaymentProcessingCents
  );
}

const paidOrderLinesInWindowWhere = (gte: Date, lte: Date) => ({
  order: {
    status: OrderStatus.paid,
    createdAt: { gte, lte },
  },
});

/** Safe until `OrderLine.productionFeeCents` migration + Prisma client are live in prod. */
async function sumPaidOrderLineProductionFeeCents(
  prisma: PrismaClient,
  gte: Date,
  lte: Date,
): Promise<number> {
  try {
    const result = await prisma.orderLine.aggregate({
      where: paidOrderLinesInWindowWhere(gte, lte),
      _sum: { productionFeeCents: true },
    });
    return result._sum.productionFeeCents ?? 0;
  } catch {
    return 0;
  }
}

/** Persisted production fee on a merged merchandise row (0 when column/client unavailable). */
export function mergedLineProductionFeeCents(line: { productionFeeCents?: number | null }): number {
  return Math.max(0, line.productionFeeCents ?? 0);
}

/**
 * Shop creation revenue = paid shop setup and reactivation checkouts.
 *
 * Include:
 * - {@link ShopSetupFeePurchase} paid at self-signup checkout
 * - {@link CreatorGiftPurchase} with `setupFeeIncluded` paid at setup gift checkout
 * - {@link ShopReactivationPurchase} paid at inactivity reactivation checkout
 *
 * Exclude:
 * - Admin beta tester batches (`isBetaTesterBatch`)
 * - Admin waived shop fee invite codes (`isWaivedShopFeeBatch`)
 * - Synthetic test rows without Stripe/mock checkout proof
 * - Gift code redemption at signup (no new payment row)
 *
 * Paid setup gifts count at gift purchase `paidAt`, not when the code is redeemed.
 */
export function paidShopSetupCheckoutWhere() {
  return {
    amountCents: { gt: 0 },
    OR: [
      { stripeCheckoutSessionId: { not: null } },
      { stripePaymentIntentId: { not: null } },
    ],
  };
}

export function shopSetupFeePurchaseRevenueWhere(gte: Date, lte: Date) {
  return {
    status: ShopSetupFeePurchaseStatus.paid,
    paidAt: { not: null, gte, lte },
    ...paidShopSetupCheckoutWhere(),
  };
}

export function giftedShopSetupPurchaseRevenueWhere(gte: Date, lte: Date) {
  return {
    status: CreatorGiftPurchaseStatus.paid,
    setupFeeIncluded: true,
    isBetaTesterBatch: false,
    isWaivedShopFeeBatch: false,
    paidAt: { not: null, gte, lte },
    ...paidShopSetupCheckoutWhere(),
  };
}

export function shopReactivationPurchaseRevenueWhere(gte: Date, lte: Date) {
  return {
    status: ShopReactivationPurchaseStatus.paid,
    paidAt: { not: null, gte, lte },
    ...paidShopSetupCheckoutWhere(),
  };
}

export type ShopCreationRevenueRowSnapshot = {
  source: "shop_setup_fee" | "creator_gift" | "shop_reactivation";
  status: string;
  amountCents: number;
  setupFeeIncluded?: boolean;
  isBetaTesterBatch?: boolean;
  isWaivedShopFeeBatch?: boolean;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
};

/** Pure classifier for tests and audits — mirrors aggregate filters. */
export function countsTowardShopCreationRevenue(row: ShopCreationRevenueRowSnapshot): boolean {
  if (row.status !== "paid") return false;
  if (row.amountCents <= 0) return false;
  if (!row.stripeCheckoutSessionId && !row.stripePaymentIntentId) return false;
  if (row.source === "shop_setup_fee") return true;
  if (row.source === "shop_reactivation") return true;
  if (!row.setupFeeIncluded) return false;
  if (row.isBetaTesterBatch) return false;
  if (row.isWaivedShopFeeBatch) return false;
  return true;
}

/**
 * Platform revenue by category for an arbitrary UTC `[gte, lte]` window.
 * Shop upgrades → Listings / Promotions: {@link aggregateShopUpgradesPlatformRevenue}.
 */
export async function aggregatePlatformRevenueForUtcWindow(
  prisma: PrismaClient,
  gte: Date,
  lte: Date,
): Promise<PlatformSalesPeriodTotals> {
  const orderLineSum = await prisma.orderLine.aggregate({
    where: paidOrderLinesInWindowWhere(gte, lte),
    _sum: {
      platformCutCents: true,
      goodsServicesCostCents: true,
      shopCutCents: true,
    },
  });

  const itemPlatformCents = orderLineSum._sum.platformCutCents ?? 0;
  const itemGoodsServicesCents = orderLineSum._sum.goodsServicesCostCents ?? 0;
  const itemShopCutCents = orderLineSum._sum.shopCutCents ?? 0;
  const itemProductionFeeCents = await sumPaidOrderLineProductionFeeCents(prisma, gte, lte);

  const paidMerchandiseOrders = await prisma.order.findMany({
    where: {
      status: OrderStatus.paid,
      createdAt: { gte, lte },
    },
    select: {
      subtotalCents: true,
      tipCents: true,
      shippingCents: true,
      totalCents: true,
    },
  });
  const itemCheckoutPaidCents = paidMerchandiseOrders.reduce(
    (sum, order) => sum + order.totalCents,
    0,
  );
  const itemShopTipCents = paidMerchandiseOrders.reduce(
    (sum, order) => sum + Math.max(0, order.tipCents),
    0,
  );
  const shopSalesPaymentProcessingCents = paidMerchandiseOrders.reduce(
    (sum, order) => sum + merchandiseOrderStripeBalanceFeeCents(order),
    0,
  );
  const itemBuyerStripePassThroughCents = paidMerchandiseOrders.reduce(
    (sum, order) => sum + merchandiseOrderStripePassThroughCents(order),
    0,
  );

  const supportTipsInWindow = await prisma.supportTip.findMany({
    where: { createdAt: { gte, lte } },
    select: { amountCents: true },
  });
  const supportPlatformCents = supportTipsInWindow.reduce(
    (sum, row) => sum + supportTipMerchandiseCents(row),
    0,
  );

  const shopSetupRows = await prisma.shopSetupFeePurchase.findMany({
    where: shopSetupFeePurchaseRevenueWhere(gte, lte),
    select: { amountCents: true },
  });

  const giftedSetupRows = await prisma.creatorGiftPurchase.findMany({
    where: giftedShopSetupPurchaseRevenueWhere(gte, lte),
    select: { amountCents: true },
  });

  const shopReactivationRows = await prisma.shopReactivationPurchase.findMany({
    where: shopReactivationPurchaseRevenueWhere(gte, lte),
    select: { amountCents: true },
  });

  const shopUpgradesRevenue = await aggregateShopUpgradesPlatformRevenue(prisma, gte, lte);

  let platformSalesPaymentProcessingCents = 0;

  let shopCreationPlatformCents = 0;
  for (const row of [...shopSetupRows, ...giftedSetupRows]) {
    shopCreationPlatformCents += SHOP_SETUP_FEE_CENTS;
    platformSalesPaymentProcessingCents += stripeBalanceProcessingFeeCents(row.amountCents);
  }
  for (const row of shopReactivationRows) {
    shopCreationPlatformCents += SHOP_REACTIVATION_FEE_CENTS;
    platformSalesPaymentProcessingCents += stripeBalanceProcessingFeeCents(row.amountCents);
  }

  const listingPlatformCents = shopUpgradesRevenue.listingMerchandiseCents;
  const promotionPlatformCents = shopUpgradesRevenue.promotionMerchandiseCents;
  platformSalesPaymentProcessingCents += shopUpgradesRevenue.paymentProcessingCents;

  for (const row of supportTipsInWindow) {
    const merchandiseCents = supportTipMerchandiseCents(row);
    platformSalesPaymentProcessingCents += stripeBalanceProcessingFeeCents(
      buyerCheckoutTotalCents(merchandiseCents),
    );
  }

  const tippedOrders = await prisma.order.findMany({
    where: {
      status: OrderStatus.paid,
      tipCents: { gt: 0 },
      createdAt: { gte, lte },
    },
    select: { tipCents: true },
  });
  const cartTipPlatformCents = tippedOrders.reduce(
    (sum, o) => sum + checkoutTipProcessingSurchargeCents(o.tipCents),
    0,
  );

  return {
    itemCheckoutPaidCents,
    itemPlatformCents,
    itemGoodsServicesCents,
    itemShopCutCents,
    itemShopTipCents,
    itemProductionFeeCents,
    itemPlatformMerchandiseTakeCents:
      itemPlatformCents + itemGoodsServicesCents + itemProductionFeeCents,
    itemBuyerStripePassThroughCents,
    listingPlatformCents,
    shopCreationPlatformCents,
    promotionPlatformCents,
    supportPlatformCents,
    cartTipPlatformCents,
    platformSalesPaymentProcessingCents,
    shopSalesPaymentProcessingCents,
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

/** UTC calendar quarter containing `through`, from quarter start through `through`. */
export async function loadPlatformSalesCurrentQuarterTotals(
  prisma: PrismaClient,
  through: Date,
): Promise<PlatformSalesPeriodTotals> {
  const { gte, lte } = utcQuarterToDateRangeThrough(through);
  return aggregatePlatformRevenueForUtcWindow(prisma, gte, lte);
}

/** Lifetime platform revenue since Jun 2026 UTC, divided by months the site has existed. */
export async function loadPlatformSalesMonthlyAverageTotals(
  prisma: PrismaClient,
  through: Date,
): Promise<PlatformSalesMonthlyAverageSummary> {
  const monthCount = utcMonthsSincePlatformSalesEpochThrough(through);
  const range = utcPlatformSalesLifetimeRangeThrough(through);
  if (!range) {
    return { monthCount: 0, totals: emptyPlatformSalesPeriodTotals() };
  }
  const lifetime = await aggregatePlatformRevenueForUtcWindow(prisma, range.gte, range.lte);
  return {
    monthCount,
    totals: averagePlatformSalesPeriodTotals(lifetime, monthCount),
  };
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

const SALES_HISTORICAL_ROLLUP_CACHE_S = 60 * 60 * 12;

function sumPlatformSalesPeriodTotals(
  a: PlatformSalesPeriodTotals,
  b: PlatformSalesPeriodTotals,
): PlatformSalesPeriodTotals {
  return {
    itemCheckoutPaidCents: a.itemCheckoutPaidCents + b.itemCheckoutPaidCents,
    itemPlatformCents: a.itemPlatformCents + b.itemPlatformCents,
    itemGoodsServicesCents: a.itemGoodsServicesCents + b.itemGoodsServicesCents,
    itemShopCutCents: a.itemShopCutCents + b.itemShopCutCents,
    itemShopTipCents: a.itemShopTipCents + b.itemShopTipCents,
    itemProductionFeeCents: a.itemProductionFeeCents + b.itemProductionFeeCents,
    itemPlatformMerchandiseTakeCents: a.itemPlatformMerchandiseTakeCents + b.itemPlatformMerchandiseTakeCents,
    itemBuyerStripePassThroughCents:
      a.itemBuyerStripePassThroughCents + b.itemBuyerStripePassThroughCents,
    listingPlatformCents: a.listingPlatformCents + b.listingPlatformCents,
    shopCreationPlatformCents: a.shopCreationPlatformCents + b.shopCreationPlatformCents,
    promotionPlatformCents: a.promotionPlatformCents + b.promotionPlatformCents,
    supportPlatformCents: a.supportPlatformCents + b.supportPlatformCents,
    cartTipPlatformCents: a.cartTipPlatformCents + b.cartTipPlatformCents,
    platformSalesPaymentProcessingCents:
      a.platformSalesPaymentProcessingCents + b.platformSalesPaymentProcessingCents,
    shopSalesPaymentProcessingCents:
      a.shopSalesPaymentProcessingCents + b.shopSalesPaymentProcessingCents,
  };
}

function utcYearStartThroughEndOfPreviousCalendarMonth(through: Date): { gte: Date; lte: Date } | null {
  const year = through.getUTCFullYear();
  const month = through.getUTCMonth();
  if (month === 0) return null;
  const gte = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const lte = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { gte, lte };
}

export function platformSalesUtcMonthTitles(reference: Date): {
  currentMonthTitle: string;
  currentQuarterTitle: string;
} {
  const fmt = (y: number, m: number) =>
    new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(y, m, 1)),
    );
  const cy = reference.getUTCFullYear();
  const cm = reference.getUTCMonth();
  return {
    currentMonthTitle: fmt(cy, cm),
    currentQuarterTitle: platformSalesCurrentUtcQuarterTitle(reference),
  };
}

async function loadPlatformSalesPreviousMonthTotalsUncached(throughIso: string): Promise<PlatformSalesPeriodTotals> {
  const through = new Date(throughIso);
  return loadPlatformSalesPreviousMonthTotals(prisma, through);
}

/** Cached full prior UTC calendar month — historical rollup only. */
export async function loadPlatformSalesPreviousMonthTotalsCached(
  through: Date,
): Promise<PlatformSalesPeriodTotals> {
  const key = `${through.getUTCFullYear()}-${through.getUTCMonth()}`;
  return unstable_cache(
    () => loadPlatformSalesPreviousMonthTotalsUncached(through.toISOString()),
    [`admin-platform-sales-prev-month:v1:${key}`],
    { revalidate: SALES_HISTORICAL_ROLLUP_CACHE_S },
  )();
}

async function loadPlatformSalesPriorCalendarYearTotalsUncached(throughIso: string): Promise<PlatformSalesYtdTotals> {
  const through = new Date(throughIso);
  return loadPlatformSalesPriorCalendarYearTotals(prisma, through);
}

/** Cached full prior UTC calendar year. */
export async function loadPlatformSalesPriorCalendarYearTotalsCached(
  through: Date,
): Promise<PlatformSalesYtdTotals> {
  const year = through.getUTCFullYear() - 1;
  return unstable_cache(
    () => loadPlatformSalesPriorCalendarYearTotalsUncached(through.toISOString()),
    [`admin-platform-sales-prior-year:v1:${year}`],
    { revalidate: SALES_HISTORICAL_ROLLUP_CACHE_S },
  )();
}

async function loadPlatformSalesYtdPriorMonthsUncached(
  year: number,
  throughIso: string,
): Promise<PlatformSalesPeriodTotals> {
  const through = new Date(throughIso);
  const range = utcYearStartThroughEndOfPreviousCalendarMonth(through);
  if (!range || range.gte.getUTCFullYear() !== year) {
    return emptyPlatformSalesPeriodTotals();
  }
  return aggregatePlatformRevenueForUtcWindow(prisma, range.gte, range.lte);
}

/**
 * YTD through `through`: cached Jan–prior-month plus live current-month totals.
 */
export async function loadPlatformSalesYtdTotalsHybrid(through: Date): Promise<PlatformSalesYtdTotals> {
  const year = through.getUTCFullYear();
  const priorMonths = await unstable_cache(
    () => loadPlatformSalesYtdPriorMonthsUncached(year, through.toISOString()),
    [`admin-platform-sales-ytd-prior-months:v1:${year}:${through.getUTCMonth()}`],
    { revalidate: SALES_HISTORICAL_ROLLUP_CACHE_S },
  )();
  const currentMonth = await loadPlatformSalesCurrentMonthTotals(prisma, through);
  const totals = sumPlatformSalesPeriodTotals(priorMonths, currentMonth);
  return { year, ...totals };
}
