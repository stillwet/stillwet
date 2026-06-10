import type { PrismaClient } from "@/generated/prisma/client";
import {
  CreatorGiftPurchaseStatus,
  ListingCreditPackPurchaseStatus,
  PromotionKind,
  PromotionPurchaseStatus,
  ShopFlairPurchaseStatus,
  ShopGoogleShoppingPurchaseStatus,
} from "@/generated/prisma/enums";
import { DASHBOARD_PROMOTIONS_PATH } from "@/lib/dashboard-promotions-path";
import { googleShoppingCreditPackById } from "@/lib/google-shopping-credit-packs";
import { listingCreditPackById } from "@/lib/listing-credit-packs";
import { promotionPriceCentsForKind } from "@/lib/promotions";
import { SHOP_FLAIR_ACCESS_PRICE_CENTS } from "@/lib/shop-flair";
import {
  buyerCheckoutTotalCents,
  merchandiseSubtotalFromCheckoutTotalCents,
  stripeBalanceProcessingFeeCents,
} from "@/lib/stripe-card-processing-fee";

/**
 * Admin Platform sales revenue from the creator shop upgrades page ({@link DASHBOARD_PROMOTIONS_PATH}).
 *
 * - **Listings** — listing credit packs and gifted listing credits
 * - **Promotions** — placements, flair, Google Shopping, and other upgrade checkouts
 *
 * **When adding a new shop upgrades purchase type:**
 * 1. Add a `*PurchaseMerchandiseCents` helper below.
 * 2. Register in {@link aggregateShopUpgradesPlatformRevenue} under Listings or Promotions.
 * 3. Add a merged admin sales line in `loadMergedPlatformSalesLines` (and filter category if new).
 * 4. If creator gifts can grant it, extend {@link giftedShopUpgradePurchaseWhere}.
 */
export type ShopUpgradesPlatformRevenueTotals = {
  listingMerchandiseCents: number;
  promotionMerchandiseCents: number;
  /** Stripe pass-through on shop-upgrades checkouts (subtract in Platform sales profit). */
  paymentProcessingCents: number;
};

export type CreatorGiftShopUpgradeRevenueRow = {
  amountCents: number;
  listingCreditPackId: string | null;
  listingCreditsGranted: number;
  googleShoppingCreditPackId: string | null;
  googleShoppingCreditsGranted: number;
  promotionKind: PromotionKind | null;
  promotionCreditsGranted: number;
  shopFlairIncluded: boolean;
};

/** Paid creator gifts for shop-upgrade credits (not setup-only gifts). */
export function giftedShopUpgradePurchaseWhere(gte: Date, lte: Date) {
  return {
    status: CreatorGiftPurchaseStatus.paid,
    isBetaTesterBatch: false,
    isWaivedShopFeeBatch: false,
    paidAt: { not: null, gte, lte },
    OR: [
      { listingCreditsGranted: { gt: 0 } },
      { promotionCreditsGranted: { gt: 0 } },
      { googleShoppingCreditsGranted: { gt: 0 } },
      { shopFlairIncluded: true },
    ],
  };
}

export function promotionPurchaseMerchandiseCents(row: {
  amountCents: number;
  kind: PromotionKind;
  paidViaPromotionCredit: boolean;
}): number {
  if (row.paidViaPromotionCredit || row.amountCents <= 0) return 0;
  const catalogMerch = promotionPriceCentsForKind(row.kind);
  if (row.amountCents >= buyerCheckoutTotalCents(catalogMerch)) return catalogMerch;
  return merchandiseSubtotalFromCheckoutTotalCents(row.amountCents);
}

export function listingCreditPackPurchaseMerchandiseCents(row: {
  amountCents: number;
  packId: string;
}): number {
  const pack = listingCreditPackById(row.packId);
  if (pack) return pack.priceCents;
  return merchandiseSubtotalFromCheckoutTotalCents(row.amountCents);
}

export function shopFlairPurchaseMerchandiseCents(row: { amountCents: number }): number {
  if (row.amountCents <= 0) return 0;
  if (row.amountCents === SHOP_FLAIR_ACCESS_PRICE_CENTS) return SHOP_FLAIR_ACCESS_PRICE_CENTS;
  if (row.amountCents >= buyerCheckoutTotalCents(SHOP_FLAIR_ACCESS_PRICE_CENTS)) {
    return SHOP_FLAIR_ACCESS_PRICE_CENTS;
  }
  return merchandiseSubtotalFromCheckoutTotalCents(row.amountCents);
}

export function shopGoogleShoppingPurchaseMerchandiseCents(row: {
  amountCents: number;
  packId: string;
}): number {
  if (row.amountCents <= 0) return 0;
  const pack = googleShoppingCreditPackById(row.packId);
  if (pack) return pack.priceCents;
  return merchandiseSubtotalFromCheckoutTotalCents(row.amountCents);
}

export function creatorGiftListingMerchandiseCents(row: CreatorGiftShopUpgradeRevenueRow): number {
  if (row.listingCreditsGranted <= 0 && !row.listingCreditPackId) return 0;
  const pack = row.listingCreditPackId ? listingCreditPackById(row.listingCreditPackId) : null;
  return pack?.priceCents ?? 0;
}

function creatorGiftPromotionMerchandiseCents(row: CreatorGiftShopUpgradeRevenueRow): number {
  if (!row.promotionKind || row.promotionCreditsGranted <= 0) return 0;
  return promotionPriceCentsForKind(row.promotionKind) * row.promotionCreditsGranted;
}

export function creatorGiftNonListingShopUpgradeMerchandiseCents(
  row: CreatorGiftShopUpgradeRevenueRow,
): number {
  const googlePack = row.googleShoppingCreditPackId
    ? googleShoppingCreditPackById(row.googleShoppingCreditPackId)
    : null;
  return (
    creatorGiftPromotionMerchandiseCents(row) +
    (googlePack?.priceCents ?? 0) +
    (row.shopFlairIncluded ? SHOP_FLAIR_ACCESS_PRICE_CENTS : 0)
  );
}

function foldListingCheckout(
  totals: ShopUpgradesPlatformRevenueTotals,
  checkoutTotalCents: number,
  merchandiseSubtotalCents: number,
): void {
  if (merchandiseSubtotalCents <= 0) return;
  totals.listingMerchandiseCents += merchandiseSubtotalCents;
  totals.paymentProcessingCents += stripeBalanceProcessingFeeCents(checkoutTotalCents);
}

function foldPromotionCheckout(
  totals: ShopUpgradesPlatformRevenueTotals,
  checkoutTotalCents: number,
  merchandiseSubtotalCents: number,
): void {
  if (merchandiseSubtotalCents <= 0) return;
  totals.promotionMerchandiseCents += merchandiseSubtotalCents;
  totals.paymentProcessingCents += stripeBalanceProcessingFeeCents(checkoutTotalCents);
}

/**
 * Sum shop-upgrades merchandise (Listings + Promotions) and Stripe pass-through.
 */
export async function aggregateShopUpgradesPlatformRevenue(
  prisma: PrismaClient,
  gte: Date,
  lte: Date,
): Promise<ShopUpgradesPlatformRevenueTotals> {
  const paidAtWindow = { not: null, gte, lte } as const;

  const [
    promotionRows,
    listingCreditPackRows,
    shopFlairPurchaseRows,
    shopGoogleShoppingPurchaseRows,
    giftedShopUpgradePurchases,
  ] = await Promise.all([
    prisma.promotionPurchase.findMany({
      where: {
        status: PromotionPurchaseStatus.paid,
        paidAt: paidAtWindow,
      },
      select: { amountCents: true, kind: true, paidViaPromotionCredit: true },
    }),
    prisma.listingCreditPackPurchase.findMany({
      where: {
        status: ListingCreditPackPurchaseStatus.paid,
        paidAt: paidAtWindow,
      },
      select: { amountCents: true, packId: true },
    }),
    prisma.shopFlairPurchase.findMany({
      where: {
        status: ShopFlairPurchaseStatus.paid,
        paidAt: paidAtWindow,
        amountCents: { gt: 0 },
      },
      select: { amountCents: true },
    }),
    prisma.shopGoogleShoppingPurchase.findMany({
      where: {
        status: ShopGoogleShoppingPurchaseStatus.paid,
        paidAt: paidAtWindow,
        amountCents: { gt: 0 },
      },
      select: { amountCents: true, packId: true },
    }),
    prisma.creatorGiftPurchase.findMany({
      where: giftedShopUpgradePurchaseWhere(gte, lte),
      select: {
        amountCents: true,
        listingCreditPackId: true,
        listingCreditsGranted: true,
        googleShoppingCreditPackId: true,
        googleShoppingCreditsGranted: true,
        promotionKind: true,
        promotionCreditsGranted: true,
        shopFlairIncluded: true,
      },
    }),
  ]);

  const totals: ShopUpgradesPlatformRevenueTotals = {
    listingMerchandiseCents: 0,
    promotionMerchandiseCents: 0,
    paymentProcessingCents: 0,
  };

  for (const row of promotionRows) {
    foldPromotionCheckout(
      totals,
      row.amountCents,
      promotionPurchaseMerchandiseCents(row),
    );
  }
  for (const row of listingCreditPackRows) {
    foldListingCheckout(
      totals,
      row.amountCents,
      listingCreditPackPurchaseMerchandiseCents(row),
    );
  }
  for (const row of shopFlairPurchaseRows) {
    foldPromotionCheckout(
      totals,
      row.amountCents,
      shopFlairPurchaseMerchandiseCents(row),
    );
  }
  for (const row of shopGoogleShoppingPurchaseRows) {
    foldPromotionCheckout(
      totals,
      row.amountCents,
      shopGoogleShoppingPurchaseMerchandiseCents(row),
    );
  }
  for (const row of giftedShopUpgradePurchases) {
    const listingMerchandiseCents = creatorGiftListingMerchandiseCents(row);
    const promotionMerchandiseCents = creatorGiftNonListingShopUpgradeMerchandiseCents(row);
    const totalMerchandiseCents = listingMerchandiseCents + promotionMerchandiseCents;
    if (totalMerchandiseCents <= 0) continue;

    totals.listingMerchandiseCents += listingMerchandiseCents;
    totals.promotionMerchandiseCents += promotionMerchandiseCents;
    totals.paymentProcessingCents += stripeBalanceProcessingFeeCents(row.amountCents);
  }

  return totals;
}
