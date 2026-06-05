import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { releaseShopUsersForVerifiedAccountDeletion } from "@/lib/shop-account-deletion-request-effects";
import {
  connectBalanceBlocksDeletion,
  getStripeConnectBalanceUsdCents,
} from "@/lib/stripe-connect-balance";

export type CompleteVerifiedShopAccountDeletionResult =
  | { ok: true; deleted: true; shopSlug: string; releasedUserCount: number }
  | {
      ok: true;
      deleted: false;
      reason: "stripe_balance" | "email_not_confirmed" | "shop_missing";
      stripeConnectBalance: { availableCents: number; pendingCents: number } | null;
      releasedUserCount: number;
    }
  | { ok: false; error: string };

/** Permanently deletes the shop when email deletion is confirmed and Stripe Connect balance is $0. */
export async function completeVerifiedShopAccountDeletion(
  shopId: string,
): Promise<CompleteVerifiedShopAccountDeletionResult> {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: {
      id: true,
      slug: true,
      stripeConnectAccountId: true,
      accountDeletionEmailConfirmedAt: true,
    },
  });

  if (!shop) {
    return {
      ok: true,
      deleted: false,
      reason: "shop_missing",
      stripeConnectBalance: null,
      releasedUserCount: 0,
    };
  }

  if (!shop.accountDeletionEmailConfirmedAt) {
    return {
      ok: true,
      deleted: false,
      reason: "email_not_confirmed",
      stripeConnectBalance: null,
      releasedUserCount: 0,
    };
  }

  const releasedUserCount = await releaseShopUsersForVerifiedAccountDeletion(shop.id);

  const stripeConnectBalance = await getStripeConnectBalanceUsdCents(shop.stripeConnectAccountId);
  if (connectBalanceBlocksDeletion(stripeConnectBalance)) {
    return {
      ok: true,
      deleted: false,
      reason: "stripe_balance",
      stripeConnectBalance,
      releasedUserCount,
    };
  }

  const listings = await prisma.shopListing.findMany({
    where: { shopId: shop.id },
    select: { productId: true },
  });
  const productIds = [...new Set(listings.map((l) => l.productId))];

  try {
    await prisma.$transaction(async (tx) => {
      await tx.shop.update({
        where: { id: shop.id },
        data: { homeFeaturedListingId: null },
      });
      await tx.shop.delete({ where: { id: shop.id } });
    });
  } catch (e) {
    console.error("[completeVerifiedShopAccountDeletion] delete failed", e);
    return { ok: false, error: "Could not remove the shop account. Try again or contact support." };
  }

  for (const pid of productIds) {
    const used = await prisma.orderLine.count({ where: { productId: pid } });
    if (used > 0) continue;
    await prisma.product.delete({ where: { id: pid } }).catch(() => {});
  }

  return { ok: true, deleted: true, shopSlug: shop.slug, releasedUserCount };
}

/** Cron: finish deleting shops whose owners were already released after email confirmation. */
export async function processPendingVerifiedShopAccountDeletions(options?: {
  limit?: number;
}): Promise<{ checked: number; deleted: number; stillBlockedByStripe: number; errors: number }> {
  const limit = Math.min(Math.max(options?.limit ?? 25, 1), 100);
  const shops = await prisma.shop.findMany({
    where: {
      slug: { not: PLATFORM_SHOP_SLUG },
      accountDeletionEmailConfirmedAt: { not: null },
    },
    select: { id: true },
    orderBy: { accountDeletionEmailConfirmedAt: "asc" },
    take: limit,
  });

  let deleted = 0;
  let stillBlockedByStripe = 0;
  let errors = 0;

  for (const shop of shops) {
    const result = await completeVerifiedShopAccountDeletion(shop.id);
    if (!result.ok) {
      errors++;
      continue;
    }
    if (result.deleted) {
      deleted++;
    } else if (result.reason === "stripe_balance") {
      stillBlockedByStripe++;
    }
  }

  return { checked: shops.length, deleted, stillBlockedByStripe, errors };
}
