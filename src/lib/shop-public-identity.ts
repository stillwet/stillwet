import type { Prisma } from "@/generated/prisma/client";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { prisma } from "@/lib/prisma";

/** Shops with no owner should not reserve slug / display name for new signups. */
export const shopReservesPublicIdentityWhere = {
  slug: { not: PLATFORM_SHOP_SLUG },
  users: { some: {} },
} satisfies Prisma.ShopWhereInput;

/** Tombstone slug/displayName so a deleted ownerless shop frees its public name. */
export async function releaseOrphanShopPublicIdentityFields(shopId: string): Promise<boolean> {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { id: true, slug: true },
  });
  if (!shop || shop.slug === PLATFORM_SHOP_SLUG) return false;

  const ownerCount = await prisma.shopUser.count({ where: { shopId } });
  if (ownerCount > 0) return false;

  const tombstoneSlug = `deleted-${shop.id}`;
  if (shop.slug === tombstoneSlug) return false;

  await prisma.shop.update({
    where: { id: shopId },
    data: {
      slug: tombstoneSlug,
      displayName: `[deleted] ${shop.id.slice(0, 8)}`,
    },
  });
  return true;
}

/** One-shot cleanup for ownerless shops left after account deletion (Stripe balance pending, etc.). */
export async function releaseAllOrphanShopPublicIdentities(): Promise<number> {
  const orphans = await prisma.shop.findMany({
    where: {
      slug: { not: PLATFORM_SHOP_SLUG },
      users: { none: {} },
      NOT: { slug: { startsWith: "deleted-" } },
    },
    select: { id: true },
    take: 500,
  });

  let released = 0;
  for (const row of orphans) {
    if (await releaseOrphanShopPublicIdentityFields(row.id)) released += 1;
  }
  return released;
}
