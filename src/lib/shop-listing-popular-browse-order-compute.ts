import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { PromotionKind, PromotionPurchaseStatus } from "@/generated/prisma/enums";
import {
  compareShopListingIdsForPopularBrowse,
  maxActivePopularPromotionMsByListing,
  type PopularPromotionPurchaseRow,
} from "@/lib/shop-listing-browse-promotion-sort";

const ID_CHUNK = 6000;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Σ (qty × unit price) for paid orders only — one aggregated query per chunk. */
async function paidOrderRevenueByShopListingId(ids: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (ids.length === 0) return map;
  for (const batch of chunk(ids, ID_CHUNK)) {
    const rows = await prisma.$queryRaw<Array<{ shopListingId: string; revenue: bigint }>>`
      SELECT ol."shopListingId", SUM(ol.quantity * ol."unitPriceCents")::bigint AS revenue
      FROM "OrderLine" ol
      INNER JOIN "Order" o ON o.id = ol."orderId"
      WHERE o.status = 'paid'::"OrderStatus"
        AND ol."shopListingId" IN (${Prisma.join(batch)})
      GROUP BY ol."shopListingId"
    `;
    for (const r of rows) {
      map.set(r.shopListingId, Number(r.revenue));
    }
  }
  return map;
}

async function fetchPopularPromotionRowsForListings(
  listingIds: string[],
): Promise<PopularPromotionPurchaseRow[]> {
  const out: PopularPromotionPurchaseRow[] = [];
  for (const batch of chunk(listingIds, ID_CHUNK)) {
    const rows = await prisma.promotionPurchase.findMany({
      where: {
        shopListingId: { in: batch },
        kind: PromotionKind.MOST_POPULAR_OF_TAG_ITEM,
        status: PromotionPurchaseStatus.paid,
        paidAt: { not: null },
      },
      select: {
        shopListingId: true,
        paidAt: true,
        eligibleFrom: true,
        status: true,
      },
    });
    out.push(...(rows as PopularPromotionPurchaseRow[]));
  }
  return out;
}

function fetchProductMetaFromListingRows(
  rows: Array<{
    id: string;
    product: { storefrontViewCount: number; name: string };
  }>,
): Map<string, { storefrontViewCount: number; name: string }> {
  return new Map(
    rows.map((r) => [
      r.id,
      {
        storefrontViewCount: r.product.storefrontViewCount,
        name: r.product.name,
      },
    ]),
  );
}

/**
 * Full Popular-sort ordering for all listings matching `where` (promotion → revenue → views → name).
 */
export async function computePopularBrowseOrderedListingIds(
  where: Prisma.ShopListingWhereInput,
): Promise<string[]> {
  const listingLight = await prisma.shopListing.findMany({
    where,
    select: {
      id: true,
      product: { select: { storefrontViewCount: true, name: true } },
    },
  });
  return await sortListingIdsForPopularBrowseFromLightRows(listingLight);
}

export async function sortListingIdsForPopularBrowseFromLightRows(
  listingLight: Array<{
    id: string;
    product: { storefrontViewCount: number; name: string };
  }>,
): Promise<string[]> {
  const ids = listingLight.map((r) => r.id);
  if (ids.length === 0) return [];

  const [promoRows, revenue] = await Promise.all([
    fetchPopularPromotionRowsForListings(ids),
    paidOrderRevenueByShopListingId(ids),
  ]);

  const promoMs = maxActivePopularPromotionMsByListing(promoRows);
  const productMeta = fetchProductMetaFromListingRows(listingLight);

  return [...ids].sort((a, b) =>
    compareShopListingIdsForPopularBrowse(a, b, promoMs, revenue, productMeta),
  );
}
