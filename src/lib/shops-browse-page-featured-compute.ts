import { prisma } from "@/lib/prisma";
import {
  PLATFORM_SHOP_SLUG,
  platformFeaturedShopPinSlugs,
} from "@/lib/marketplace-constants";
import { buyerSalesShopConnectPrismaWhere } from "@/lib/shop-stripe-connect-gate";
import {
  PromotionKind,
  PromotionPurchaseStatus,
  OrderStatus,
} from "@/generated/prisma/enums";
import {
  addUtcMonths,
  isPaidPromotionActiveNow,
  startOfUtcMonthContaining,
} from "@/lib/promotion-policy-shared";

export const CREATOR_SHOP_BASE = {
  active: true,
  listedOnShopsBrowse: true,
  slug: { not: PLATFORM_SHOP_SLUG },
  ...buyerSalesShopConnectPrismaWhere(),
} as const;

export type ShopBrowseFeaturedRow = {
  id: string;
  slug: string;
  displayName: string;
  profileImageUrl: string | null;
  bio: string | null;
  totalSalesCents: number;
};

export const selectFeatured = {
  id: true,
  slug: true,
  displayName: true,
  profileImageUrl: true,
  bio: true,
  totalSalesCents: true,
} as const;

export function toFeaturedRow(
  s: {
    id: string;
    slug: string;
    displayName: string;
    profileImageUrl: string | null;
    bio: string | null;
    totalSalesCents: number;
  },
): ShopBrowseFeaturedRow {
  return {
    id: s.id,
    slug: s.slug,
    displayName: s.displayName,
    profileImageUrl: s.profileImageUrl,
    bio: s.bio,
    totalSalesCents: s.totalSalesCents,
  };
}

function dedupeFeaturedRowsById(rows: ShopBrowseFeaturedRow[]): ShopBrowseFeaturedRow[] {
  const seen = new Set<string>();
  const out: ShopBrowseFeaturedRow[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

/**
 * When both pins already appear in indices 0–4, keep order. Otherwise insert pin A at index 3 and pin B at 4.
 */
function applyFeaturedShopPins(
  ranked: ShopBrowseFeaturedRow[],
  pinA: ShopBrowseFeaturedRow | null,
  pinB: ShopBrowseFeaturedRow | null,
  slugA: string | undefined,
  slugB: string | undefined,
  limit: number,
): ShopBrowseFeaturedRow[] {
  if (!slugA || !slugB || !pinA || !pinB) {
    return ranked.slice(0, limit);
  }

  const ia = ranked.findIndex((r) => r.slug === slugA);
  const ib = ranked.findIndex((r) => r.slug === slugB);
  const inTop5 = (i: number) => i >= 0 && i < 5;

  if (inTop5(ia) && inTop5(ib)) {
    return ranked.slice(0, limit);
  }

  const rest = ranked.filter((r) => r.slug !== slugA && r.slug !== slugB);
  const out: ShopBrowseFeaturedRow[] = [];
  let ri = 0;
  for (let pos = 0; pos < limit; pos++) {
    if (pos === 3) {
      out.push(pinA);
      continue;
    }
    if (pos === 4) {
      out.push(pinB);
      continue;
    }
    const next = rest[ri];
    if (!next) break;
    ri += 1;
    out.push(next);
  }
  return dedupeFeaturedRowsById(out).slice(0, limit);
}

/**
 * Live featured-shops ranking (promotions → month sales → views → pins). Used by daily snapshot rebuild
 * and fallback reads.
 */
export async function computeFeaturedShopsRankedRows(
  limit: number,
): Promise<ShopBrowseFeaturedRow[]> {
  const now = new Date();
  const pinSlugs = platformFeaturedShopPinSlugs();
  const pinSlugA = pinSlugs[0];
  const pinSlugB = pinSlugs[1];

  const purchases = await prisma.promotionPurchase.findMany({
    where: {
      kind: PromotionKind.FEATURED_SHOP_HOME,
      status: PromotionPurchaseStatus.paid,
      paidAt: { not: null },
      shop: CREATOR_SHOP_BASE,
    },
    select: {
      status: true,
      paidAt: true,
      eligibleFrom: true,
      shopId: true,
      shop: {
        select: {
          ...selectFeatured,
          storefrontViewCount: true,
        },
      },
    },
    orderBy: { paidAt: "desc" },
  });

  const bestActiveByShop = new Map<
    string,
    { paidAt: Date; shop: (typeof purchases)[0]["shop"] }
  >();
  for (const p of purchases) {
    if (
      !isPaidPromotionActiveNow({
        status: p.status,
        eligibleFrom: p.eligibleFrom,
        paidAt: p.paidAt,
      })
    ) {
      continue;
    }
    const cur = bestActiveByShop.get(p.shopId);
    if (!cur || p.paidAt!.getTime() > cur.paidAt.getTime()) {
      bestActiveByShop.set(p.shopId, { paidAt: p.paidAt!, shop: p.shop });
    }
  }

  const promoted = [...bestActiveByShop.values()]
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())
    .map((x) => toFeaturedRow(x.shop));

  const promotedIds = new Set(promoted.map((r) => r.id));

  const monthStart = startOfUtcMonthContaining(now);
  const nextMonth = addUtcMonths(monthStart, 1);

  const salesAgg = await prisma.orderLine.groupBy({
    by: ["shopId"],
    where: {
      shopId: { not: null },
      order: {
        status: OrderStatus.paid,
        createdAt: { gte: monthStart, lt: nextMonth },
      },
    },
    _sum: { shopCutCents: true },
  });
  const salesByShopId = new Map<string, number>();
  for (const row of salesAgg) {
    if (row.shopId) {
      salesByShopId.set(row.shopId, row._sum.shopCutCents ?? 0);
    }
  }

  const organicRaw = await prisma.shop.findMany({
    where: {
      ...CREATOR_SHOP_BASE,
      ...(promotedIds.size > 0 ? { id: { notIn: [...promotedIds] } } : {}),
    },
    select: {
      ...selectFeatured,
      storefrontViewCount: true,
    },
  });

  const organicSorted = [...organicRaw].sort((a, b) => {
    const sa = salesByShopId.get(a.id) ?? 0;
    const sb = salesByShopId.get(b.id) ?? 0;
    if (sb !== sa) return sb - sa;
    if (b.storefrontViewCount !== a.storefrontViewCount) {
      return b.storefrontViewCount - a.storefrontViewCount;
    }
    return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
  });

  const organic = organicSorted.map(toFeaturedRow);

  const merged = dedupeFeaturedRowsById([...promoted, ...organic]);

  const pinIn =
    pinSlugA && pinSlugB ? ([pinSlugA, pinSlugB] as string[]) : ([] as string[]);
  const pinRows =
    pinIn.length > 0
      ? await prisma.shop.findMany({
          where: {
            active: true,
            AND: [{ slug: { in: pinIn } }, { slug: { not: PLATFORM_SHOP_SLUG } }],
          },
          select: selectFeatured,
        })
      : [];
  const pinBySlug = new Map(pinRows.map((r) => [r.slug, toFeaturedRow(r)]));
  const pinRowA = pinSlugA ? pinBySlug.get(pinSlugA) ?? null : null;
  const pinRowB = pinSlugB ? pinBySlug.get(pinSlugB) ?? null : null;

  const pinned = applyFeaturedShopPins(merged, pinRowA, pinRowB, pinSlugA, pinSlugB, limit);
  return pinned.slice(0, limit);
}
