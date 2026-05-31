"use server";

import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { normalizeShopSlugInput } from "@/lib/normalize-shop-slug-input";
import { prisma } from "@/lib/prisma";

export type GiftRecipientShopPick = {
  id: string;
  slug: string;
  displayName: string;
};

const SUGGESTION_LIMIT = 12;
const MIN_QUERY_LEN = 2;

function orderShopMatches(shops: GiftRecipientShopPick[], normalizedQuery: string): GiftRecipientShopPick[] {
  const q = normalizedQuery.toLowerCase();
  const exact = shops.find((s) => s.slug.toLowerCase() === q);
  const ordered = exact ? [exact, ...shops.filter((s) => s.slug !== exact.slug)] : shops;
  return ordered.slice(0, SUGGESTION_LIMIT);
}

export async function searchGiftRecipientShops(query: string): Promise<GiftRecipientShopPick[]> {
  const trimmed = query.trim();
  const normalized = normalizeShopSlugInput(trimmed);
  if (normalized.length < MIN_QUERY_LEN && trimmed.length < MIN_QUERY_LEN) {
    return [];
  }

  const shops = await prisma.shop.findMany({
    where: {
      slug: { not: PLATFORM_SHOP_SLUG },
      OR: [
        { slug: { contains: normalized, mode: "insensitive" } },
        { displayName: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    select: { id: true, slug: true, displayName: true },
    orderBy: { slug: "asc" },
    take: 24,
  });

  return orderShopMatches(shops, normalized);
}

export async function verifyGiftRecipientShop(
  raw: string,
): Promise<{ ok: true; shop: GiftRecipientShopPick } | { ok: false; error: string }> {
  const shopSlug = normalizeShopSlugInput(raw);
  if (!shopSlug) {
    return { ok: false, error: "Enter a shop name or slug." };
  }
  if (shopSlug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "That shop cannot receive gifts." };
  }

  const shop = await prisma.shop.findUnique({
    where: { slug: shopSlug },
    select: { id: true, slug: true, displayName: true },
  });
  if (!shop) {
    return { ok: false, error: `No shop found with slug “${shopSlug}”.` };
  }

  return { ok: true, shop };
}
