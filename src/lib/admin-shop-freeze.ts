import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";

export function shopIsAdminFrozen(shop: { adminFrozenAt: Date | null }): boolean {
  return shop.adminFrozenAt != null;
}

function visibilityAfterAdminUnfreeze(shop: {
  inactivityDeactivatedAt: Date | null;
  accountDeletionRequestedAt: Date | null;
  ownerPausedShopAt: Date | null;
}): { active: boolean; listedOnShopsBrowse: boolean } {
  if (shop.inactivityDeactivatedAt || shop.accountDeletionRequestedAt) {
    return { active: false, listedOnShopsBrowse: false };
  }
  if (shop.ownerPausedShopAt) {
    return { active: true, listedOnShopsBrowse: false };
  }
  return { active: true, listedOnShopsBrowse: true };
}

export async function adminFreezeShopById(shopId: string): Promise<
  | { ok: true; slug: string }
  | { ok: false; error: string }
> {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { id: true, slug: true, adminFrozenAt: true },
  });
  if (!shop) return { ok: false, error: "Shop not found." };
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "The platform catalog shop cannot be frozen." };
  }
  if (shop.adminFrozenAt) {
    return { ok: false, error: "That shop is already frozen." };
  }

  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      adminFrozenAt: new Date(),
      active: false,
      listedOnShopsBrowse: false,
    },
  });

  return { ok: true, slug: shop.slug };
}

export async function adminUnfreezeShopById(shopId: string): Promise<
  | { ok: true; slug: string }
  | { ok: false; error: string }
> {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: {
      id: true,
      slug: true,
      adminFrozenAt: true,
      inactivityDeactivatedAt: true,
      accountDeletionRequestedAt: true,
      ownerPausedShopAt: true,
    },
  });
  if (!shop) return { ok: false, error: "Shop not found." };
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "The platform catalog shop cannot be unfrozen." };
  }
  if (!shop.adminFrozenAt) {
    return { ok: false, error: "That shop is not admin-frozen." };
  }

  const visibility = visibilityAfterAdminUnfreeze(shop);
  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      adminFrozenAt: null,
      ...visibility,
    },
  });

  return { ok: true, slug: shop.slug };
}
