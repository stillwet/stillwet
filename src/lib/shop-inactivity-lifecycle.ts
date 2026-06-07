import { OrderStatus } from "@/generated/prisma/enums";
import {
  SHOP_INACTIVITY_DEACTIVATE_DAYS,
  SHOP_INACTIVITY_DELETE_AFTER_DAYS,
  SHOP_INACTIVITY_WARNING_DAYS,
  daysAgo,
} from "@/lib/shop-inactivity-policy";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { prisma } from "@/lib/prisma";
import { sendShopInactivityWarningEmail } from "@/lib/send-shop-inactivity-warning-email";
import {
  applyVerifiedAccountDeletionListingAndMediaCleanup,
  purgeShopUploadedMediaFromR2,
} from "@/lib/shop-account-deletion-request-effects";
import { completeVerifiedShopAccountDeletion } from "@/lib/complete-verified-shop-account-deletion";

export type ShopInactivityLifecycleResult = {
  warningsSent: number;
  warningFailures: number;
  deactivated: number;
  deletionTriggered: number;
};

function noLoginSince(cutoff: Date) {
  return {
    NOT: {
      users: {
        some: {
          OR: [
            { lastLoginAt: { gt: cutoff } },
            { lastLoginAt: null, createdAt: { gt: cutoff } },
          ],
        },
      },
    },
  };
}

export async function processShopInactivityLifecycle(
  now: Date = new Date(),
): Promise<ShopInactivityLifecycleResult> {
  const warningCutoff = daysAgo(SHOP_INACTIVITY_WARNING_DAYS, now);
  const deactivateCutoff = daysAgo(SHOP_INACTIVITY_DEACTIVATE_DAYS, now);
  const deleteCutoff = daysAgo(SHOP_INACTIVITY_DELETE_AFTER_DAYS, now);

  const result: ShopInactivityLifecycleResult = {
    warningsSent: 0,
    warningFailures: 0,
    deactivated: 0,
    deletionTriggered: 0,
  };

  const warningCandidates = await prisma.shop.findMany({
    where: {
      active: true,
      slug: { not: PLATFORM_SHOP_SLUG },
      accountDeletionRequestedAt: null,
      inactivityWarningSentAt: null,
      inactivityDeactivatedAt: null,
      ...noLoginSince(warningCutoff),
    },
    select: {
      id: true,
      users: { select: { email: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
    take: 1000,
  });

  for (const shop of warningCandidates) {
    const email = shop.users[0]?.email;
    if (!email) continue;
    const sent = await sendShopInactivityWarningEmail(email);
    if (!sent.ok) {
      result.warningFailures++;
      console.error("[shop-inactivity] warning email failed", shop.id, sent.error);
      continue;
    }
    await prisma.shop.update({
      where: { id: shop.id },
      data: { inactivityWarningSentAt: now },
    });
    result.warningsSent++;
  }

  const deactivated = await prisma.shop.updateMany({
    where: {
      active: true,
      slug: { not: PLATFORM_SHOP_SLUG },
      accountDeletionRequestedAt: null,
      inactivityDeactivatedAt: null,
      ...noLoginSince(deactivateCutoff),
    },
    // Dashboard access is blocked via `inactivityDeactivatedAt`; public shop/listings stay visible.
    data: { inactivityDeactivatedAt: now },
  });
  result.deactivated = deactivated.count;

  const deletionCandidates = await prisma.shop.findMany({
    where: {
      slug: { not: PLATFORM_SHOP_SLUG },
      inactivityDeactivatedAt: { lte: deleteCutoff },
      inactivityDeletionTriggeredAt: null,
      accountDeletionRequestedAt: null,
    },
    select: { id: true, inactivityDeactivatedAt: true },
    take: 100,
  });

  for (const shop of deletionCandidates) {
    if (!shop.inactivityDeactivatedAt) continue;
    const paidOrdersSinceDeactivation = await prisma.order.count({
      where: {
        shopId: shop.id,
        status: OrderStatus.paid,
        createdAt: { gte: shop.inactivityDeactivatedAt },
      },
    });
    if (paidOrdersSinceDeactivation > 0) continue;

    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        active: false,
        accountDeletionRequestedAt: now,
        accountDeletionEmailConfirmedAt: now,
        inactivityDeletionTriggeredAt: now,
        homeFeaturedListingId: null,
      },
    });
    await purgeShopUploadedMediaFromR2(shop.id);
    await applyVerifiedAccountDeletionListingAndMediaCleanup(shop.id, now);
    await completeVerifiedShopAccountDeletion(shop.id);
    result.deletionTriggered++;
  }

  return result;
}
