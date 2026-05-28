import { prisma } from "@/lib/prisma";
import type { ShopSetupShopPayload } from "@/components/dashboard/ShopSetupTabs";

export type ShopFlairDashboardPayload = NonNullable<ShopSetupShopPayload["flair"]>;

/** Flair catalog + purchase state for dashboard shop profile and promotions page. */
export async function loadShopFlairDashboardPayload(
  shopId: string,
): Promise<ShopFlairDashboardPayload> {
  const [types, shopFlair] = await Promise.all([
    prisma.shopFlairType.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, slug: true, label: true },
    }),
    prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        flairPurchasedAt: true,
        flairType: { select: { id: true, slug: true, label: true } },
      },
    }),
  ]);

  return {
    purchasedAt: shopFlair?.flairPurchasedAt?.toISOString() ?? null,
    selectedType: shopFlair?.flairType
      ? {
          id: shopFlair.flairType.id,
          slug: shopFlair.flairType.slug,
          label: shopFlair.flairType.label,
        }
      : null,
    catalog: { types },
  };
}
