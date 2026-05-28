import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSessionReadonly } from "@/lib/session";

export type DashboardTabApiShop = {
  shopId: string;
  shopSlug: string;
  isPlatform: boolean;
};

export async function resolveDashboardTabApiShop(): Promise<
  | { ok: true; shop: DashboardTabApiShop }
  | { ok: false; status: 401 | 403 }
> {
  const owner = await getShopOwnerSessionReadonly();
  if (!owner.shopUserId) return { ok: false, status: 401 };

  const row = await prisma.shopUser.findUnique({
    where: { id: owner.shopUserId },
    select: { shop: { select: { id: true, slug: true, inactivityDeactivatedAt: true } } },
  });
  if (!row?.shop) return { ok: false, status: 401 };

  const isPlatform = row.shop.slug === PLATFORM_SHOP_SLUG;
  if (isPlatform) {
    return {
      ok: true,
      shop: { shopId: row.shop.id, shopSlug: row.shop.slug, isPlatform: true },
    };
  }
  if (row.shop.inactivityDeactivatedAt) return { ok: false, status: 403 };

  return {
    ok: true,
    shop: { shopId: row.shop.id, shopSlug: row.shop.slug, isPlatform: false },
  };
}
