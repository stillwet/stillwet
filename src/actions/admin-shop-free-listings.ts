"use server";

import { redirect } from "next/navigation";
import { ADMIN_BACKEND_BASE_PATH } from "@/lib/admin-dashboard-urls";
import { syncFreeListingFeeWaivers } from "@/lib/listing-fee";
import {
  isFounderUnlimitedFreeListingsShop,
  listingFeeFreeSlotCap,
  PLATFORM_SHOP_SLUG,
} from "@/lib/marketplace-constants";
import { normalizeShopSlugInput } from "@/lib/normalize-shop-slug-input";
import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { notifyShopFreeListingSlotsGranted } from "@/lib/shop-free-listing-grant-notice";
import { prisma } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";

const MAX_SLOTS_PER_GRANT = 500;

export type AdminGrantFreeListingsActionResult =
  | { ok: true; shopSlug: string; slotsGranted: number; totalBonusSlots: number; totalFreeCap: number }
  | { ok: false; error: string };

export async function adminGrantShopFreeListingSlots(
  formData: FormData,
): Promise<AdminGrantFreeListingsActionResult> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) return { ok: false, error: "Unauthorized." };

  const shopSlug = normalizeShopSlugInput(String(formData.get("shopSlug") ?? ""));
  if (!shopSlug) {
    return { ok: false, error: "Enter a shop slug (the username in /s/your-slug)." };
  }

  const slotsRaw = String(formData.get("slots") ?? "").trim();
  const slots = Number.parseInt(slotsRaw, 10);
  if (!Number.isFinite(slots) || slots < 1) {
    return { ok: false, error: "Enter a positive number of free listings to grant." };
  }
  if (slots > MAX_SLOTS_PER_GRANT) {
    return { ok: false, error: `Grant at most ${MAX_SLOTS_PER_GRANT} slots per submission.` };
  }

  if (shopSlug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "The platform catalog shop does not use publication fees." };
  }

  const shop = await prisma.shop.findUnique({
    where: { slug: shopSlug },
    select: { id: true, slug: true, displayName: true, listingFeeBonusFreeSlots: true },
  });
  if (!shop) {
    return { ok: false, error: `No shop found with slug “${shopSlug}”.` };
  }

  if (isFounderUnlimitedFreeListingsShop(shop.slug)) {
    return {
      ok: false,
      error: "That shop already has unlimited free publication slots (founder shop).",
    };
  }

  const updated = await prisma.shop.update({
    where: { id: shop.id },
    data: { listingFeeBonusFreeSlots: { increment: slots } },
    select: { listingFeeBonusFreeSlots: true, slug: true },
  });

  await syncFreeListingFeeWaivers(shop.id);

  const totalBonus = updated.listingFeeBonusFreeSlots;
  const totalFreeCap = listingFeeFreeSlotCap(updated.slug, totalBonus);

  await notifyShopFreeListingSlotsGranted({
    shopId: shop.id,
    slotsGranted: slots,
    totalBonusSlots: totalBonus,
    totalFreeCap,
  });

  revalidateAdminViews();

  return {
    ok: true,
    shopSlug: updated.slug,
    slotsGranted: slots,
    totalBonusSlots: totalBonus,
    totalFreeCap,
  };
}

export async function adminGrantShopFreeListingSlotsForm(formData: FormData): Promise<void> {
  const r = await adminGrantShopFreeListingSlots(formData);
  if (!r.ok) {
    redirect(
      `${ADMIN_BACKEND_BASE_PATH}?tab=free-listings&fl_err=${encodeURIComponent(r.error)}#free-listings`,
    );
  }
  redirect(
    `${ADMIN_BACKEND_BASE_PATH}?tab=free-listings&fl_saved=1&fl_shop=${encodeURIComponent(r.shopSlug)}&fl_granted=${r.slotsGranted}&fl_total_bonus=${r.totalBonusSlots}&fl_total_cap=${r.totalFreeCap}#free-listings`,
  );
}

export type AdminShopSlugPick = {
  slug: string;
  displayName: string;
};

export type AdminShopFreeListingGrantRow = {
  slug: string;
  displayName: string;
  listingFeeBonusFreeSlots: number;
  totalFreeCap: number;
};

/** All creator shops for admin grant form typeahead (loaded once per tab visit; filtered on the client). */
export async function loadAdminShopSlugPickerOptions(): Promise<AdminShopSlugPick[]> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) return [];

  return prisma.shop.findMany({
    where: { slug: { not: PLATFORM_SHOP_SLUG } },
    select: { slug: true, displayName: true },
    orderBy: { slug: "asc" },
    take: 5000,
  });
}

/** Confirm a slug exists before grant submit (admin only). */
export async function verifyAdminShopSlugForFreeListingGrant(
  raw: string,
): Promise<{ ok: true; shop: AdminShopSlugPick } | { ok: false }> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) return { ok: false };

  const shopSlug = normalizeShopSlugInput(raw);
  if (!shopSlug || shopSlug === PLATFORM_SHOP_SLUG) return { ok: false };

  const shop = await prisma.shop.findUnique({
    where: { slug: shopSlug },
    select: { slug: true, displayName: true },
  });
  if (!shop) return { ok: false };

  return { ok: true, shop };
}

export async function loadAdminShopsWithBonusFreeListingSlots(): Promise<AdminShopFreeListingGrantRow[]> {
  const rows = await prisma.shop.findMany({
    where: {
      slug: { not: PLATFORM_SHOP_SLUG },
      listingFeeBonusFreeSlots: { gt: 0 },
    },
    orderBy: [{ listingFeeBonusFreeSlots: "desc" }, { slug: "asc" }],
    take: 100,
    select: { slug: true, displayName: true, listingFeeBonusFreeSlots: true },
  });
  return rows.map((r) => ({
    slug: r.slug,
    displayName: r.displayName,
    listingFeeBonusFreeSlots: r.listingFeeBonusFreeSlots,
    totalFreeCap: listingFeeFreeSlotCap(r.slug, r.listingFeeBonusFreeSlots),
  }));
}
