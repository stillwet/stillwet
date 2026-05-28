import type { Prisma } from "@/generated/prisma/client";
import { OrderStatus, PromotionKind, PromotionPurchaseStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { isPaidPromotionActiveNow } from "@/lib/promotion-policy-shared";

/**
 * paid “Popular item” placement (`MOST_POPULAR_OF_TAG_ITEM`) — used only for **Popular** browse sort.
 */
export const shopListingPopularItemPromotionPurchasesArgs = {
  where: {
    status: PromotionPurchaseStatus.paid,
    paidAt: { not: null },
    kind: PromotionKind.MOST_POPULAR_OF_TAG_ITEM,
  },
  select: { paidAt: true, eligibleFrom: true, status: true, kind: true },
} satisfies Pick<Prisma.PromotionPurchaseFindManyArgs, "where" | "select">;

type PopularBrowseListing = {
  id: string;
  product: { storefrontViewCount: number; name: string };
  promotionPurchases?:
    | {
        paidAt: Date | null;
        eligibleFrom: Date | null;
        status: string;
        kind: PromotionKind;
      }[]
    | null;
};

/** Rows from `promotionPurchase.findMany` used to compute Popular-sort placement priority. */
export type PopularPromotionPurchaseRow = {
  shopListingId: string | null;
  paidAt: Date | null;
  eligibleFrom: Date | null;
  status: string;
};

/**
 * Max `(eligibleFrom ?? paidAt)` among **currently active** paid Popular-item placements for this
 * listing (matches legacy browse ordering).
 */
export function maxActivePopularPromotionSortMs(
  promotionPurchases: PopularBrowseListing["promotionPurchases"],
): number {
  let best = 0;
  for (const p of promotionPurchases ?? []) {
    if (!isPaidPromotionActiveNow(p)) continue;
    const t = (p.eligibleFrom ?? p.paidAt)!.getTime();
    if (t > best) best = t;
  }
  return best;
}

/**
 * One entry per listing id: best active Popular placement timestamp (for sorting).
 */
export function maxActivePopularPromotionMsByListing(
  rows: PopularPromotionPurchaseRow[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of rows) {
    if (!p.shopListingId) continue;
    if (!isPaidPromotionActiveNow(p)) continue;
    const t = (p.eligibleFrom ?? p.paidAt)!.getTime();
    const prev = map.get(p.shopListingId) ?? 0;
    if (t > prev) map.set(p.shopListingId, t);
  }
  return map;
}

/** Comparator for Popular browse (promotion → revenue → views → name). */
export function compareShopListingIdsForPopularBrowse(
  a: string,
  b: string,
  promoMs: Map<string, number>,
  revenue: Map<string, number>,
  productById: Map<string, { storefrontViewCount: number; name: string }>,
): number {
  const pa = promoMs.get(a) ?? 0;
  const pb = promoMs.get(b) ?? 0;
  if (pa !== pb) return pb - pa;

  const ra = revenue.get(a) ?? 0;
  const rb = revenue.get(b) ?? 0;
  if (ra !== rb) return rb - ra;

  const pda = productById.get(a);
  const pdb = productById.get(b);
  const va = pda?.storefrontViewCount ?? 0;
  const vb = pdb?.storefrontViewCount ?? 0;
  if (va !== vb) return vb - va;

  return (pda?.name ?? "").localeCompare(pdb?.name ?? "");
}

/**
 * Popular sort: newest paid **Popular item** promotion first, then revenue (order lines on this
 * listing), then product storefront views, then name.
 */
export async function sortShopListingsForPopularBrowse<T extends PopularBrowseListing>(
  listings: T[],
): Promise<T[]> {
  if (listings.length === 0) return listings;
  const ids = listings.map((l) => l.id);
  const lines = await prisma.orderLine.findMany({
    where: {
      shopListingId: { in: ids },
      order: { status: OrderStatus.paid },
    },
    select: { shopListingId: true, quantity: true, unitPriceCents: true },
  });
  const revenueByListing = new Map<string, number>();
  for (const line of lines) {
    if (!line.shopListingId) continue;
    const add = line.quantity * line.unitPriceCents;
    revenueByListing.set(
      line.shopListingId,
      (revenueByListing.get(line.shopListingId) ?? 0) + add,
    );
  }

  const productById = new Map(
    listings.map((l) => [
      l.id,
      { storefrontViewCount: l.product.storefrontViewCount, name: l.product.name },
    ]),
  );
  const promoMs = new Map(
    listings.map((l) => [l.id, maxActivePopularPromotionSortMs(l.promotionPurchases)]),
  );

  return [...listings].sort((a, b) =>
    compareShopListingIdsForPopularBrowse(a.id, b.id, promoMs, revenueByListing, productById),
  );
}
