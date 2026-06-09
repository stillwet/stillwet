import { unstable_cache } from "next/cache";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
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
  buyerPaymentProcessingFeeCents,
  checkoutProcessingFeeFromTotal,
} from "@/lib/stripe-card-processing-fee";

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
    },
  },
  shop: { select: { displayName: true, slug: true } },
  shopListing: { select: { requestItemName: true } },
  product: { select: { slug: true } },
} as const;

export type AdminPlatformSalesBuyer = {
  email: string | null;
  shippingState: string | null;
  shippingCountry: string | null;
};

function orderLineDisplayName(l: AdminPlatformSalesOrderLineRow): string {
  const item = l.shopListing?.requestItemName?.trim();
  if (item) return item;
  return l.productName;
}

export type AdminPlatformSalesOrderLineRow = Prisma.OrderLineGetPayload<{
  include: typeof orderLineInclude;
}>;

/** Row filters for the Platform sales lines table. */
export type AdminPlatformSaleCategory =
  | "listing"
  | "item"
  | "support"
  | "promotion"
  | "shop_creation";

/** Platform checkout rows (not buyer merchandise lines). Merch / G/S columns show —. */
export function isPlatformCheckoutMergedLine(l: AdminPlatformSalesMergedLine): boolean {
  return l.kind !== "merchandise";
}

/** Shop display name for shop checkouts, otherwise the transaction email. */
export function mergedLineTransactionPartyLabel(l: AdminPlatformSalesMergedLine): string {
  if (l.kind === "merchandise") {
    return l.buyer.email?.trim() || "—";
  }
  if (l.kind === "creator_gift_purchase") {
    return l.transactionEmail?.trim() || "—";
  }
  const shopName = l.shop?.displayName?.trim();
  if (shopName) return shopName;
  return l.transactionEmail?.trim() || "—";
}

type PlatformCheckoutMergedLineBase = {
  quantity: number;
  unitPriceCents: number;
  productName: string;
  goodsServicesCostCents: number;
  productionFeeCents: number;
  platformCutCents: number;
  shopCutCents: number;
  stripeFeeCents: number;
  order: { id: string; createdAt: Date };
  shop: { displayName: string; slug: string } | null;
  /** Checkout email when there is no purchasing shop row (gifts, pre-shop signup). */
  transactionEmail: string | null;
  itemHref: string | null;
};

export type AdminPlatformSalesMergedLine =
  | {
      kind: "merchandise";
      platformSaleCategory: "item";
      id: string;
      quantity: number;
      unitPriceCents: number;
      productName: string;
      goodsServicesCostCents: number;
      productionFeeCents: number;
      platformCutCents: number;
      shopCutCents: number;
      /** Buyer-paid Stripe pass-through allocated to this row. */
      stripeFeeCents: number;
      order: { id: string; createdAt: Date; orderNumber: number };
      shop: { displayName: string; slug: string } | null;
      buyer: AdminPlatformSalesBuyer;
      itemHref: string | null;
    }
  | ({
      kind: "listing_credit_pack_purchase";
      platformSaleCategory: "listing";
      id: string;
    } & PlatformCheckoutMergedLineBase)
  | ({
      kind: "support_tip";
      platformSaleCategory: "support";
      id: string;
    } & PlatformCheckoutMergedLineBase)
  | ({
      kind: "promotion_purchase";
      platformSaleCategory: "promotion";
      id: string;
    } & PlatformCheckoutMergedLineBase)
  | ({
      kind: "shop_setup_fee_purchase";
      platformSaleCategory: "shop_creation";
      id: string;
    } & PlatformCheckoutMergedLineBase)
  | ({
      kind: "shop_reactivation_purchase";
      platformSaleCategory: "shop_creation";
      id: string;
    } & PlatformCheckoutMergedLineBase)
  | ({
      kind: "shop_flair_purchase";
      platformSaleCategory: "promotion";
      id: string;
    } & PlatformCheckoutMergedLineBase)
  | ({
      kind: "shop_google_shopping_purchase";
      platformSaleCategory: "promotion";
      id: string;
    } & PlatformCheckoutMergedLineBase)
  | ({
      kind: "creator_gift_purchase";
      platformSaleCategory: "shop_creation" | "listing" | "promotion";
      id: string;
    } & PlatformCheckoutMergedLineBase);

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

function googleShoppingMergedLabel(packId: string): string {
  const pack = googleShoppingCreditPackById(packId);
  return pack ? `Google Shopping — ${pack.label}` : "Google Shopping credits";
}

function creatorGiftListingLabel(row: CreatorGiftShopUpgradeRevenueRow): string {
  const pack = row.listingCreditPackId ? listingCreditPackById(row.listingCreditPackId) : null;
  return pack ? `Creator gift — ${pack.label}` : "Creator gift — listing credits";
}

function creatorGiftPromotionLabel(row: CreatorGiftShopUpgradeRevenueRow): string {
  const parts: string[] = [];
  if (row.promotionKind && row.promotionCreditsGranted > 0) {
    parts.push(promotionKindLabel(row.promotionKind));
  }
  if (row.googleShoppingCreditsGranted > 0 || row.googleShoppingCreditPackId) {
    parts.push("Google Shopping credits");
  }
  if (row.shopFlairIncluded) parts.push("Shop flair");
  return parts.length > 0 ? `Creator gift — ${parts.join(", ")}` : "Creator gift — shop upgrades";
}

function allocateCheckoutStripeFeeCents(
  checkoutTotalCents: number,
  totalMerchandiseCents: number,
  segmentMerchandiseCents: number,
): number {
  if (checkoutTotalCents <= 0 || totalMerchandiseCents <= 0 || segmentMerchandiseCents <= 0) {
    return 0;
  }
  const totalFee = checkoutProcessingFeeFromTotal(checkoutTotalCents, totalMerchandiseCents);
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
  },
): Extract<AdminPlatformSalesMergedLine, { kind: K }> {
  const stripeFeeCents =
    params.stripeFeeCents ??
    checkoutProcessingFeeFromTotal(params.checkoutTotalCents, params.merchandiseCents);
  return {
    kind,
    platformSaleCategory,
    id: params.id,
    quantity: 1,
    unitPriceCents: params.checkoutTotalCents,
    productName: params.productName,
    goodsServicesCostCents: 0,
    productionFeeCents: 0,
    /** Platform merchandise revenue (excludes buyer Stripe pass-through in the adjacent column). */
    platformCutCents: params.merchandiseCents,
    shopCutCents: 0,
    stripeFeeCents,
    order: { id: params.id, createdAt: params.paidAt },
    shop: params.shop,
    transactionEmail: params.transactionEmail ?? null,
    itemHref: params.itemHref,
  } as Extract<AdminPlatformSalesMergedLine, { kind: K }>;
}

type CreatorGiftPurchaseMergedRow = CreatorGiftShopUpgradeRevenueRow & {
  id: string;
  amountCents: number;
  paidAt: Date | null;
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
      label: "Creator gift — shop setup",
      merchandiseCents: SHOP_SETUP_FEE_CENTS,
    });
  }

  const listingMerch = creatorGiftListingMerchandiseCents(row);
  if (listingMerch > 0) {
    segments.push({
      category: "listing",
      label: creatorGiftListingLabel(row),
      merchandiseCents: listingMerch,
    });
  }

  const promotionMerch = creatorGiftNonListingShopUpgradeMerchandiseCents(row);
  if (promotionMerch > 0) {
    segments.push({
      category: "promotion",
      label: creatorGiftPromotionLabel(row),
      merchandiseCents: promotionMerch,
    });
  }

  if (segments.length === 0) return [];

  const totalMerch = segments.reduce((sum, seg) => sum + seg.merchandiseCents, 0);
  const shop = row.recipientShop;

  return segments.map((seg) => {
    const isSingle = segments.length === 1;
    const checkoutTotalCents = isSingle
      ? row.amountCents
      : Math.round((row.amountCents * seg.merchandiseCents) / totalMerch);
    const stripeFeeCents = isSingle
      ? checkoutProcessingFeeFromTotal(row.amountCents, totalMerch)
      : allocateCheckoutStripeFeeCents(row.amountCents, totalMerch, seg.merchandiseCents);

    return platformCheckoutMergedLine("creator_gift_purchase", seg.category, {
      id: `creator_gift_purchase:${row.id}:${seg.category}`,
      productName: seg.label,
      checkoutTotalCents,
      merchandiseCents: seg.merchandiseCents,
      paidAt: row.paidAt!,
      shop,
      itemHref: null,
      stripeFeeCents,
      transactionEmail: row.purchaserEmail,
    });
  });
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

function allocateMerchandiseLineStripeFeeCents(
  order: {
    subtotalCents: number;
    tipCents: number;
    shippingCents: number;
    totalCents: number;
  },
  lineMerchandiseCents: number,
): number {
  const orderStripeFee = merchandiseOrderPaymentProcessingCents(order);
  if (orderStripeFee <= 0 || order.subtotalCents <= 0) return 0;
  const lineMerch = Math.max(0, lineMerchandiseCents);
  if (lineMerch <= 0) return 0;
  return Math.round((orderStripeFee * lineMerch) / order.subtotalCents);
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
      select: { id: true, amountCents: true, createdAt: true },
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
        shopFlairIncluded: true,
        purchaserEmail: true,
        recipientShop: { select: { displayName: true, slug: true } },
      },
    }),
  ]);

  const orderLines = orderLinesRaw as AdminPlatformSalesOrderLineRow[];

  const merchLines: AdminPlatformSalesMergedLine[] = orderLines.map((l) => ({
    kind: "merchandise" as const,
    platformSaleCategory: "item" as const,
    id: l.id,
    quantity: l.quantity,
    unitPriceCents: l.unitPriceCents,
    productName: orderLineDisplayName(l),
    goodsServicesCostCents: l.goodsServicesCostCents,
    productionFeeCents: mergedLineProductionFeeCents(l),
    platformCutCents: l.platformCutCents,
    shopCutCents: l.shopCutCents,
    stripeFeeCents: allocateMerchandiseLineStripeFeeCents(
      l.order,
      l.unitPriceCents * l.quantity,
    ),
    order: { id: l.order.id, createdAt: l.order.createdAt, orderNumber: l.order.orderNumber },
    shop: l.shop,
    buyer: {
      email: l.order.email,
      shippingState: l.order.shippingState,
      shippingCountry: l.order.shippingCountry,
    },
    itemHref:
      l.shop && l.product.slug ? productHref(l.shop.slug, l.product.slug) : null,
  }));

  const supportLines: AdminPlatformSalesMergedLine[] = supportTips.map((t) =>
    platformCheckoutMergedLine("support_tip", "support", {
      id: `support_tip:${t.id}`,
      productName: "Support tip",
      checkoutTotalCents: t.amountCents,
      merchandiseCents: t.amountCents,
      paidAt: t.createdAt,
      shop: null,
      itemHref: null,
      stripeFeeCents: buyerPaymentProcessingFeeCents({ subtotalCents: t.amountCents }),
    }),
  );

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
      }),
    );

  const shopFlairLines: AdminPlatformSalesMergedLine[] = shopFlairRows
    .filter((row): row is typeof row & { paidAt: Date } => row.paidAt != null)
    .map((row) =>
      platformCheckoutMergedLine("shop_flair_purchase", "promotion", {
        id: `shop_flair_purchase:${row.id}`,
        productName: "Shop flair access",
        checkoutTotalCents: row.amountCents,
        merchandiseCents: shopFlairPurchaseMerchandiseCents(row),
        paidAt: row.paidAt,
        shop: row.shop,
        itemHref: null,
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
    itemMerchandiseSoldCents: 0,
    itemPlatformCents: 0,
    itemGoodsServicesCents: 0,
    itemProductionFeeCents: 0,
    itemPlatformMerchandiseTakeCents: 0,
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
    itemMerchandiseSoldCents: avg(totals.itemMerchandiseSoldCents),
    itemPlatformCents: avg(totals.itemPlatformCents),
    itemGoodsServicesCents: avg(totals.itemGoodsServicesCents),
    itemProductionFeeCents: avg(totals.itemProductionFeeCents),
    itemPlatformMerchandiseTakeCents: avg(totals.itemPlatformMerchandiseTakeCents),
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
  /** Sum of paid-order `subtotalCents` (buyer merchandise before tip, shipping, and Stripe). */
  itemMerchandiseSoldCents: number;
  /** Sum of `OrderLine.platformCutCents` for paid orders in the window. */
  itemPlatformCents: number;
  /** Sum of `OrderLine.goodsServicesCostCents` for paid merchandise in the window. */
  itemGoodsServicesCents: number;
  /** Sum of `OrderLine.productionFeeCents` for paid merchandise in the window. */
  itemProductionFeeCents: number;
  /** Merchandise platform retention (COGS + production fee + platform fee). */
  itemPlatformMerchandiseTakeCents: number;
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
  /** Stripe pass-through on paid `Order` checkouts only (not shop setup / platform sales). */
  shopSalesPaymentProcessingCents: number;
};

export type PlatformSalesYtdTotals = PlatformSalesPeriodTotals & {
  year: number;
};

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
    },
  });

  const itemPlatformCents = orderLineSum._sum.platformCutCents ?? 0;
  const itemGoodsServicesCents = orderLineSum._sum.goodsServicesCostCents ?? 0;
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
  const itemMerchandiseSoldCents = paidMerchandiseOrders.reduce(
    (sum, order) => sum + order.subtotalCents,
    0,
  );
  const shopSalesPaymentProcessingCents = paidMerchandiseOrders.reduce(
    (sum, order) => sum + merchandiseOrderPaymentProcessingCents(order),
    0,
  );

  const supportTipsInWindow = await prisma.supportTip.findMany({
    where: { createdAt: { gte, lte } },
    select: { amountCents: true },
  });
  const supportPlatformCents = supportTipsInWindow.reduce((sum, row) => sum + row.amountCents, 0);

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
    platformSalesPaymentProcessingCents += checkoutProcessingFeeFromTotal(
      row.amountCents,
      SHOP_SETUP_FEE_CENTS,
    );
  }
  for (const row of shopReactivationRows) {
    shopCreationPlatformCents += SHOP_REACTIVATION_FEE_CENTS;
    platformSalesPaymentProcessingCents += checkoutProcessingFeeFromTotal(
      row.amountCents,
      SHOP_REACTIVATION_FEE_CENTS,
    );
  }

  const listingPlatformCents = shopUpgradesRevenue.listingMerchandiseCents;
  const promotionPlatformCents = shopUpgradesRevenue.promotionMerchandiseCents;
  platformSalesPaymentProcessingCents += shopUpgradesRevenue.paymentProcessingCents;

  for (const row of supportTipsInWindow) {
    platformSalesPaymentProcessingCents += buyerPaymentProcessingFeeCents({
      subtotalCents: row.amountCents,
    });
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
    itemMerchandiseSoldCents,
    itemPlatformCents,
    itemGoodsServicesCents,
    itemProductionFeeCents,
    itemPlatformMerchandiseTakeCents:
      itemPlatformCents + itemGoodsServicesCents + itemProductionFeeCents,
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
    itemMerchandiseSoldCents: a.itemMerchandiseSoldCents + b.itemMerchandiseSoldCents,
    itemPlatformCents: a.itemPlatformCents + b.itemPlatformCents,
    itemGoodsServicesCents: a.itemGoodsServicesCents + b.itemGoodsServicesCents,
    itemProductionFeeCents: a.itemProductionFeeCents + b.itemProductionFeeCents,
    itemPlatformMerchandiseTakeCents: a.itemPlatformMerchandiseTakeCents + b.itemPlatformMerchandiseTakeCents,
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
