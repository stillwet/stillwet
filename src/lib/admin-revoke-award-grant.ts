import type { Prisma } from "@/generated/prisma/client";
import { PromotionKind, ShopFlairPurchaseStatus } from "@/generated/prisma/enums";
import { parseAdminAwardCatalogKey } from "@/lib/admin-award-promotions-catalog";
import { syncFreeListingFeeWaivers } from "@/lib/listing-fee";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { prisma } from "@/lib/prisma";

function promotionKindFromAwardKey(awardKey: string): PromotionKind | null {
  if (!awardKey.startsWith("promotion_credit:")) return null;
  const kind = awardKey.slice("promotion_credit:".length);
  return Object.values(PromotionKind).includes(kind as PromotionKind)
    ? (kind as PromotionKind)
    : null;
}

async function revokeFreeListingSlots(
  tx: Prisma.TransactionClient,
  shopId: string,
  quantity: number,
): Promise<void> {
  const shop = await tx.shop.findUnique({
    where: { id: shopId },
    select: { listingFeeBonusFreeSlots: true },
  });
  if (!shop) throw new Error("Shop not found.");

  const nextSlots = Math.max(0, shop.listingFeeBonusFreeSlots - quantity);
  await tx.shop.update({
    where: { id: shopId },
    data: { listingFeeBonusFreeSlots: nextSlots },
  });
}

async function revokeFlairAccess(tx: Prisma.TransactionClient, shopId: string): Promise<void> {
  const paidFlair = await tx.shopFlairPurchase.findFirst({
    where: {
      shopId,
      status: ShopFlairPurchaseStatus.paid,
      amountCents: { gt: 0 },
    },
    select: { id: true },
  });
  if (paidFlair) {
    throw new Error("That shop purchased flair access separately; revoke the paid purchase instead.");
  }

  await tx.shop.update({
    where: { id: shopId },
    data: { flairPurchasedAt: null, flairTypeId: null },
  });
}

async function revokeGoogleShoppingCredits(
  tx: Prisma.TransactionClient,
  shopId: string,
  quantity: number,
): Promise<void> {
  const shop = await tx.shop.findUnique({
    where: { id: shopId },
    select: { googleShoppingCredits: true },
  });
  if (!shop) throw new Error("Shop not found.");

  await tx.shop.update({
    where: { id: shopId },
    data: { googleShoppingCredits: Math.max(0, shop.googleShoppingCredits - quantity) },
  });
}

export async function revokeAdminAwardGrantById(grantId: string): Promise<
  | {
      ok: true;
      shopSlug: string;
      awardKey: string;
      awardLabel: string;
      quantityRevoked: number;
    }
  | { ok: false; error: string }
> {
  const grant = await prisma.shopAdminAwardGrant.findUnique({
    where: { id: grantId },
    select: {
      id: true,
      shopId: true,
      awardKey: true,
      quantity: true,
      revokedAt: true,
      shop: { select: { slug: true } },
    },
  });

  if (!grant) return { ok: false, error: "Award grant not found." };
  if (grant.revokedAt) return { ok: false, error: "That award was already revoked." };
  if (grant.shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "The platform catalog shop is not eligible." };
  }

  const awardDef = parseAdminAwardCatalogKey(grant.awardKey);
  const awardLabel = awardDef?.label ?? grant.awardKey;
  const quantity = grant.quantity;

  try {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.shopAdminAwardGrant.findUnique({
        where: { id: grant.id },
        select: { revokedAt: true },
      });
      if (!locked || locked.revokedAt) {
        throw new Error("That award was already revoked.");
      }

      if (grant.awardKey === "free_listing_slots") {
        await revokeFreeListingSlots(tx, grant.shopId, quantity);
      } else if (grant.awardKey === "flair_access") {
        await revokeFlairAccess(tx, grant.shopId);
      } else if (grant.awardKey === "google_shopping_credits") {
        await revokeGoogleShoppingCredits(tx, grant.shopId, quantity);
      } else {
        const kind = promotionKindFromAwardKey(grant.awardKey);
        if (!kind) throw new Error("Unsupported award type for revoke.");
        const current = await tx.shopPromotionCreditBalance.findUnique({
          where: { shopId_kind: { shopId: grant.shopId, kind } },
          select: { credits: true },
        });
        const nextCredits = Math.max(0, (current?.credits ?? 0) - quantity);
        await tx.shopPromotionCreditBalance.upsert({
          where: { shopId_kind: { shopId: grant.shopId, kind } },
          create: { shopId: grant.shopId, kind, credits: 0 },
          update: { credits: nextCredits },
        });
      }

      await tx.shopAdminAwardGrant.update({
        where: { id: grant.id },
        data: { revokedAt: new Date() },
      });
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not revoke that award.";
    return { ok: false, error: message };
  }

  if (grant.awardKey === "free_listing_slots") {
    await syncFreeListingFeeWaivers(grant.shopId);
  }

  return {
    ok: true,
    shopSlug: grant.shop.slug,
    awardKey: grant.awardKey,
    awardLabel,
    quantityRevoked: quantity,
  };
}
