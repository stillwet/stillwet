"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ShopFlairPurchaseStatus, ShopGoogleShoppingPurchaseStatus, ShopUserRole, PromotionKind } from "@/generated/prisma/enums";
import { ADMIN_BACKEND_BASE_PATH } from "@/lib/admin-dashboard-urls";
import {
  adminAwardCatalog,
  adminAwardGrantQuantityBounds,
  parseAdminAwardCatalogKey,
} from "@/lib/admin-award-promotions-catalog";
import {
  notifyShopFlairAccessGranted,
  notifyShopGoogleShoppingCreditsGranted,
  notifyShopPromotionCreditsGranted,
} from "@/lib/admin-award-promotion-notices";
import { GOOGLE_SHOPPING_ADMIN_GRANT_PACK_ID } from "@/lib/google-shopping-credit-packs";
import { syncFreeListingFeeWaivers } from "@/lib/listing-fee";
import {
  isFounderUnlimitedFreeListingsShop,
  listingFeeFreeSlotCap,
  PLATFORM_SHOP_SLUG,
} from "@/lib/marketplace-constants";
import { normalizeShopSlugInput } from "@/lib/normalize-shop-slug-input";
import { incrementPromotionCreditBalance } from "@/lib/promotion-credit-balance";
import { revokeAdminAwardGrantById } from "@/lib/admin-revoke-award-grant";
import { promotionKindLabel } from "@/lib/promotions";
import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { notifyShopFreeListingSlotsGranted } from "@/lib/shop-free-listing-grant-notice";
import { isPrismaMissingRelationError } from "@/lib/prisma-missing-relation";
import { prisma, prismaShopAdminAwardGrantOrNull, prismaShopPromotionCreditBalanceOrNull } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";

const AWARD_PROMOTIONS_TAB = "award-promotions";
const AWARD_PROMOTIONS_ANCHOR = "#award-promotions";

export type AdminShopSlugPick = {
  slug: string;
  displayName: string;
};

export type AdminGrantFreeListingsActionResult =
  | { ok: true; shopSlug: string; slotsGranted: number; totalBonusSlots: number; totalFreeCap: number }
  | { ok: false; error: string };

export type AdminAwardPromotionGrantResult =
  | {
      ok: true;
      shopSlug: string;
      awardKey: string;
      awardLabel: string;
      quantityGranted: number;
      detail?: string;
    }
  | { ok: false; error: string };

function awardPromotionsRedirectUrl(params: Record<string, string>): string {
  const q = new URLSearchParams({ tab: AWARD_PROMOTIONS_TAB, ...params });
  return `${ADMIN_BACKEND_BASE_PATH}?${q.toString()}${AWARD_PROMOTIONS_ANCHOR}`;
}

async function resolveShopForAwardGrant(shopSlug: string) {
  if (shopSlug === PLATFORM_SHOP_SLUG) {
    return { ok: false as const, error: "The platform catalog shop is not eligible for creator awards." };
  }

  const shop = await prisma.shop.findUnique({
    where: { slug: shopSlug },
    select: {
      id: true,
      slug: true,
      displayName: true,
      listingFeeBonusFreeSlots: true,
      flairPurchasedAt: true,
    },
  });
  if (!shop) {
    return { ok: false as const, error: `No shop found with slug “${shopSlug}”.` };
  }
  return { ok: true as const, shop };
}

const AWARD_PROMOTIONS_MIGRATION = "20260528160000_shop_admin_award_promotions";

function logAwardPromotionsQueryFailure(context: string, e: unknown): void {
  if (isPrismaMissingRelationError(e)) return;
  console.error(`[${context}] query failed (migration ${AWARD_PROMOTIONS_MIGRATION}?)`, e);
}

async function writeAdminAwardGrantAudit(args: {
  shopId: string;
  awardKey: string;
  quantity: number;
}): Promise<void> {
  const delegate = prismaShopAdminAwardGrantOrNull();
  if (!delegate) return;

  try {
    await delegate.create({
      data: {
        shopId: args.shopId,
        awardKey: args.awardKey,
        quantity: args.quantity,
      },
    });
  } catch (e) {
    logAwardPromotionsQueryFailure("writeAdminAwardGrantAudit", e);
  }
}

export async function adminGrantShopFreeListingSlots(
  formData: FormData,
): Promise<AdminGrantFreeListingsActionResult> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) return { ok: false, error: "Unauthorized." };

  const shopSlug = normalizeShopSlugInput(String(formData.get("shopSlug") ?? ""));
  if (!shopSlug) {
    return { ok: false, error: "Enter a shop slug (the username in /s/your-slug)." };
  }

  const slotsRaw = String(formData.get("slots") ?? formData.get("quantity") ?? "").trim();
  const slots = Number.parseInt(slotsRaw, 10);
  if (!Number.isFinite(slots) || slots < 1) {
    return { ok: false, error: "Enter a positive number of free listings to grant." };
  }
  const bounds = adminAwardGrantQuantityBounds({
    key: "free_listing_slots",
    catalogKey: "free_listing_slots",
    label: "Free listing slots",
    description: "",
    supportsQuantity: true,
  });
  if (slots > bounds.max) {
    return { ok: false, error: `Grant at most ${bounds.max} slots per submission.` };
  }

  const resolved = await resolveShopForAwardGrant(shopSlug);
  if (!resolved.ok) return resolved;
  const { shop } = resolved;

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
  await writeAdminAwardGrantAudit({
    shopId: shop.id,
    awardKey: "free_listing_slots",
    quantity: slots,
  });

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

export async function adminAwardPromotionGrant(
  formData: FormData,
): Promise<AdminAwardPromotionGrantResult> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) return { ok: false, error: "Unauthorized." };

  const shopSlug = normalizeShopSlugInput(String(formData.get("shopSlug") ?? ""));
  if (!shopSlug) {
    return { ok: false, error: "Enter a shop slug (the username in /s/your-slug)." };
  }

  const awardKeyRaw = String(formData.get("awardKey") ?? "").trim();
  const awardDef = parseAdminAwardCatalogKey(awardKeyRaw);
  if (!awardDef) {
    return { ok: false, error: "Choose a valid award type." };
  }

  const quantityRaw = String(formData.get("quantity") ?? "1").trim();
  const quantity = awardDef.supportsQuantity ? Number.parseInt(quantityRaw, 10) : 1;
  const bounds = adminAwardGrantQuantityBounds(awardDef);
  if (!Number.isFinite(quantity) || quantity < bounds.min || quantity > bounds.max) {
    return {
      ok: false,
      error: awardDef.supportsQuantity
        ? `Enter a quantity between ${bounds.min} and ${bounds.max}.`
        : "Invalid award quantity.",
    };
  }

  if (awardDef.key === "free_listing_slots") {
    const fd = new FormData();
    fd.set("shopSlug", shopSlug);
    fd.set("quantity", String(quantity));
    const r = await adminGrantShopFreeListingSlots(fd);
    if (!r.ok) return r;
    return {
      ok: true,
      shopSlug: r.shopSlug,
      awardKey: awardDef.catalogKey,
      awardLabel: awardDef.label,
      quantityGranted: r.slotsGranted,
    };
  }

  const resolved = await resolveShopForAwardGrant(shopSlug);
  if (!resolved.ok) return resolved;
  const { shop } = resolved;

  if (awardDef.key === "flair_access") {
    const grantDelegate = prismaShopAdminAwardGrantOrNull();
    if (!grantDelegate) {
      return {
        ok: false,
        error: `Award Promotions tables are not ready. Run npx prisma migrate deploy (migration ${AWARD_PROMOTIONS_MIGRATION}).`,
      };
    }

    if (shop.flairPurchasedAt) {
      return { ok: false, error: "That shop already has flair access." };
    }

    const owner = await prisma.shopUser.findFirst({
      where: { shopId: shop.id, role: ShopUserRole.owner },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (!owner) {
      return { ok: false, error: "That shop has no owner account to attach the flair purchase to." };
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.shop.update({
        where: { id: shop.id },
        data: { flairPurchasedAt: now },
      });
      await tx.shopFlairPurchase.create({
        data: {
          shopId: shop.id,
          shopUserId: owner.id,
          amountCents: 0,
          currency: "usd",
          status: ShopFlairPurchaseStatus.paid,
          paidAt: now,
        },
      });
      await tx.shopAdminAwardGrant.create({
        data: {
          shopId: shop.id,
          awardKey: awardDef.catalogKey,
          quantity: 1,
        },
      });
    });

    await notifyShopFlairAccessGranted({ shopId: shop.id });
    revalidateAdminViews();

    return {
      ok: true,
      shopSlug: shop.slug,
      awardKey: awardDef.catalogKey,
      awardLabel: awardDef.label,
      quantityGranted: 1,
    };
  }

  if (awardDef.key === "google_shopping_credits") {
    const owner = await prisma.shopUser.findFirst({
      where: { shopId: shop.id, role: ShopUserRole.owner },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (!owner) {
      return { ok: false, error: "That shop has no owner account to attach the grant to." };
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const shopRow = await tx.shop.update({
        where: { id: shop.id },
        data: { googleShoppingCredits: { increment: quantity } },
        select: { googleShoppingCredits: true, slug: true },
      });
      await tx.shopGoogleShoppingPurchase.create({
        data: {
          shopId: shop.id,
          shopUserId: owner.id,
          packId: GOOGLE_SHOPPING_ADMIN_GRANT_PACK_ID,
          creditsGranted: quantity,
          amountCents: 0,
          currency: "usd",
          status: ShopGoogleShoppingPurchaseStatus.paid,
          paidAt: now,
        },
      });
      return shopRow;
    });

    await writeAdminAwardGrantAudit({
      shopId: shop.id,
      awardKey: awardDef.catalogKey,
      quantity,
    });
    await notifyShopGoogleShoppingCreditsGranted({
      shopId: shop.id,
      creditsGranted: quantity,
      totalCredits: updated.googleShoppingCredits,
    });
    revalidateAdminViews();

    return {
      ok: true,
      shopSlug: updated.slug,
      awardKey: awardDef.catalogKey,
      awardLabel: awardDef.label,
      quantityGranted: quantity,
    };
  }

  if (awardDef.key === "promotion_credit") {
    if (!prismaShopPromotionCreditBalanceOrNull()) {
      return {
        ok: false,
        error: `Award Promotions tables are not ready. Run npx prisma migrate deploy (migration ${AWARD_PROMOTIONS_MIGRATION}).`,
      };
    }

    const totalCredits = await incrementPromotionCreditBalance(
      shop.id,
      awardDef.promotionKind,
      quantity,
    );
    await writeAdminAwardGrantAudit({
      shopId: shop.id,
      awardKey: awardDef.catalogKey,
      quantity,
    });
    await notifyShopPromotionCreditsGranted({
      shopId: shop.id,
      kind: awardDef.promotionKind,
      creditsGranted: quantity,
      totalCredits,
    });
    revalidateAdminViews();

    return {
      ok: true,
      shopSlug: shop.slug,
      awardKey: awardDef.catalogKey,
      awardLabel: awardDef.label,
      quantityGranted: quantity,
    };
  }

  return { ok: false, error: "Unsupported award type." };
}

export type AdminRevokeAwardGrantResult =
  | {
      ok: true;
      shopSlug: string;
      awardKey: string;
      awardLabel: string;
      quantityRevoked: number;
    }
  | { ok: false; error: string };

export async function adminRevokeAwardGrant(
  formData: FormData,
): Promise<AdminRevokeAwardGrantResult> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) return { ok: false, error: "Unauthorized." };

  const grantId = String(formData.get("grantId") ?? "").trim();
  if (!grantId) return { ok: false, error: "Missing award grant id." };

  const result = await revokeAdminAwardGrantById(grantId);
  if (result.ok) {
    revalidateAdminViews();
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/shop-upgrades");
  }
  return result;
}

export async function adminRevokeAwardGrantForm(formData: FormData): Promise<void> {
  const r = await adminRevokeAwardGrant(formData);
  if (!r.ok) {
    redirect(awardPromotionsRedirectUrl({ ap_err: r.error }));
  }
  redirect(
    awardPromotionsRedirectUrl({
      ap_revoked: "1",
      ap_shop: r.shopSlug,
      ap_award: r.awardKey,
      ap_granted: String(r.quantityRevoked),
    }),
  );
}

export async function adminAwardPromotionGrantForm(formData: FormData): Promise<void> {
  const r = await adminAwardPromotionGrant(formData);
  if (!r.ok) {
    redirect(awardPromotionsRedirectUrl({ ap_err: r.error }));
  }
  redirect(
    awardPromotionsRedirectUrl({
      ap_saved: "1",
      ap_shop: r.shopSlug,
      ap_award: r.awardKey,
      ap_granted: String(r.quantityGranted),
      ...(r.detail ? { ap_detail: r.detail } : {}),
    }),
  );
}

/** @deprecated Use adminAwardPromotionGrantForm with awardKey free_listing_slots */
export async function adminGrantShopFreeListingSlotsForm(formData: FormData): Promise<void> {
  const fd = new FormData();
  fd.set("shopSlug", String(formData.get("shopSlug") ?? ""));
  fd.set("awardKey", "free_listing_slots");
  fd.set("quantity", String(formData.get("slots") ?? formData.get("quantity") ?? "1"));
  await adminAwardPromotionGrantForm(fd);
}

export type AdminShopFreeListingGrantRow = {
  slug: string;
  displayName: string;
  /** Sum of admin grants from the audit log (excludes purchases and gift codes). */
  adminAwardedSlots: number;
};

export type AdminShopGoogleShoppingCreditRow = {
  slug: string;
  displayName: string;
  /** Sum of admin grants from the audit log (excludes pack purchases). */
  adminAwardedCredits: number;
};

export type AdminPromotionCreditBalanceRow = {
  slug: string;
  displayName: string;
  kind: string;
  kindLabel: string;
  /** Sum of admin grants from the audit log. */
  adminAwardedCredits: number;
};

export type AdminRecentAwardGrantRow = {
  id: string;
  grantedAtIso: string;
  revokedAtIso: string | null;
  shopSlug: string;
  shopDisplayName: string;
  awardKey: string;
  awardLabel: string;
  quantity: number;
};

export async function loadAdminShopSlugPickerOptions(): Promise<AdminShopSlugPick[]> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) return [];

  return prisma.shop.findMany({
    where: { slug: { not: PLATFORM_SHOP_SLUG }, users: { some: {} } },
    select: { slug: true, displayName: true },
    orderBy: { slug: "asc" },
    take: 5000,
  });
}

export async function verifyAdminShopSlugForAwardGrant(
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

/** @deprecated Use verifyAdminShopSlugForAwardGrant */
export async function verifyAdminShopSlugForFreeListingGrant(
  raw: string,
): Promise<{ ok: true; shop: AdminShopSlugPick } | { ok: false }> {
  return verifyAdminShopSlugForAwardGrant(raw);
}

async function loadAdminAwardGrantTotals(): Promise<
  Array<{ shopId: string; awardKey: string; totalQuantity: number }>
> {
  const delegate = prismaShopAdminAwardGrantOrNull();
  if (!delegate) return [];

  try {
    const rows = await delegate.groupBy({
      by: ["shopId", "awardKey"],
      where: { revokedAt: null, shop: { slug: { not: PLATFORM_SHOP_SLUG } } },
      _sum: { quantity: true },
    });
    return rows
      .map((r) => ({
        shopId: r.shopId,
        awardKey: r.awardKey,
        totalQuantity: r._sum.quantity ?? 0,
      }))
      .filter((r) => r.totalQuantity > 0);
  } catch (e) {
    logAwardPromotionsQueryFailure("loadAdminAwardGrantTotals", e);
    return [];
  }
}

async function loadShopsByIdForAdminAwardSummaries(
  shopIds: string[],
): Promise<Map<string, { slug: string; displayName: string }>> {
  if (shopIds.length === 0) return new Map();

  const shops = await prisma.shop.findMany({
    where: { id: { in: shopIds } },
    select: { id: true, slug: true, displayName: true },
  });
  return new Map(shops.map((s) => [s.id, { slug: s.slug, displayName: s.displayName }]));
}

export async function loadAdminShopsWithBonusFreeListingSlots(): Promise<AdminShopFreeListingGrantRow[]> {
  const totals = await loadAdminAwardGrantTotals();
  const freeListingTotals = totals.filter((r) => r.awardKey === "free_listing_slots");
  if (freeListingTotals.length === 0) return [];

  const shopById = await loadShopsByIdForAdminAwardSummaries([
    ...new Set(freeListingTotals.map((r) => r.shopId)),
  ]);

  return freeListingTotals
    .map((r) => {
      const shop = shopById.get(r.shopId);
      if (!shop) return null;
      return {
        slug: shop.slug,
        displayName: shop.displayName,
        adminAwardedSlots: r.totalQuantity,
      };
    })
    .filter((r): r is AdminShopFreeListingGrantRow => r != null)
    .sort((a, b) => b.adminAwardedSlots - a.adminAwardedSlots || a.slug.localeCompare(b.slug))
    .slice(0, 100);
}

export async function loadAdminShopsWithGoogleShoppingCredits(): Promise<
  AdminShopGoogleShoppingCreditRow[]
> {
  const totals = await loadAdminAwardGrantTotals();
  const googleTotals = totals.filter((r) => r.awardKey === "google_shopping_credits");
  if (googleTotals.length === 0) return [];

  const shopById = await loadShopsByIdForAdminAwardSummaries([
    ...new Set(googleTotals.map((r) => r.shopId)),
  ]);

  return googleTotals
    .map((r) => {
      const shop = shopById.get(r.shopId);
      if (!shop) return null;
      return {
        slug: shop.slug,
        displayName: shop.displayName,
        adminAwardedCredits: r.totalQuantity,
      };
    })
    .filter((r): r is AdminShopGoogleShoppingCreditRow => r != null)
    .sort((a, b) => b.adminAwardedCredits - a.adminAwardedCredits || a.slug.localeCompare(b.slug))
    .slice(0, 100);
}

export async function loadAdminShopsWithPromotionCreditBalances(): Promise<
  AdminPromotionCreditBalanceRow[]
> {
  const delegate = prismaShopAdminAwardGrantOrNull();
  if (!delegate) return [];

  const catalog = adminAwardCatalog();
  const labelByKey = new Map(catalog.map((d) => [d.catalogKey, d.label]));

  const totals = await loadAdminAwardGrantTotals();
  const promotionTotals = totals.filter((r) => r.awardKey.startsWith("promotion_credit:"));
  if (promotionTotals.length === 0) return [];

  const shopById = await loadShopsByIdForAdminAwardSummaries([
    ...new Set(promotionTotals.map((r) => r.shopId)),
  ]);

  return promotionTotals
    .map((r) => {
      const shop = shopById.get(r.shopId);
      if (!shop) return null;
      const kind = r.awardKey.slice("promotion_credit:".length);
      return {
        slug: shop.slug,
        displayName: shop.displayName,
        kind,
        kindLabel: labelByKey.get(r.awardKey) ?? promotionKindLabel(kind as PromotionKind),
        adminAwardedCredits: r.totalQuantity,
      };
    })
    .filter((r): r is AdminPromotionCreditBalanceRow => r != null)
    .sort(
      (a, b) =>
        b.adminAwardedCredits - a.adminAwardedCredits || a.slug.localeCompare(b.slug),
    )
    .slice(0, 200);
}

export async function loadAdminRecentAwardGrants(): Promise<AdminRecentAwardGrantRow[]> {
  const delegate = prismaShopAdminAwardGrantOrNull();
  if (!delegate) return [];

  const catalog = adminAwardCatalog();
  const labelByKey = new Map(catalog.map((d) => [d.catalogKey, d.label]));

  try {
    const rows = await delegate.findMany({
      where: { shop: { slug: { not: PLATFORM_SHOP_SLUG } } },
      orderBy: { grantedAt: "desc" },
      take: 50,
      select: {
        id: true,
        awardKey: true,
        quantity: true,
        grantedAt: true,
        revokedAt: true,
        shop: { select: { slug: true, displayName: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      grantedAtIso: r.grantedAt.toISOString(),
      revokedAtIso: r.revokedAt?.toISOString() ?? null,
      shopSlug: r.shop.slug,
      shopDisplayName: r.shop.displayName,
      awardKey: r.awardKey,
      awardLabel: labelByKey.get(r.awardKey) ?? r.awardKey,
      quantity: r.quantity,
    }));
  } catch (e) {
    logAwardPromotionsQueryFailure("loadAdminRecentAwardGrants", e);
    return [];
  }
}

export async function loadAdminAwardPromotionsMigrationRequired(): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ grantTable: string | null; creditTable: string | null }>
    >`
      SELECT
        to_regclass('public."ShopAdminAwardGrant"')::text AS "grantTable",
        to_regclass('public."ShopPromotionCreditBalance"')::text AS "creditTable"
    `;
    const row = rows[0];
    if (!row?.grantTable || !row?.creditTable) return true;
    return false;
  } catch (e) {
    logAwardPromotionsQueryFailure("loadAdminAwardPromotionsMigrationRequired", e);
    return true;
  }
}

export { adminAwardCatalog };
