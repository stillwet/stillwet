import { revalidatePath } from "next/cache";
import { revalidateShopUpgradesDashboardPaths } from "@/lib/dashboard-revalidate-shop-upgrades";
import { ShopGoogleShoppingPurchaseStatus } from "@/generated/prisma/enums";
import { GOOGLE_SHOPPING_LEGACY_PACK_ID } from "@/lib/google-shopping-credit-packs";
import { prisma } from "@/lib/prisma";

/** Credits granted for legacy one-time shop-wide access payments (in-flight webhooks). */
export const LEGACY_GOOGLE_SHOPPING_ACCESS_CREDITS = 10;

/**
 * Marks a Google Shopping pack purchase paid and grants listing credits. Idempotent for `paid`.
 */
export async function fulfillShopGoogleShoppingPurchaseIfPending(
  purchaseId: string,
  stripe: {
    paymentIntentId: string;
    paidAmountCents?: number;
  },
): Promise<boolean> {
  const purchase = await prisma.shopGoogleShoppingPurchase.findUnique({
    where: { id: purchaseId },
    select: {
      id: true,
      shopId: true,
      status: true,
      amountCents: true,
      creditsGranted: true,
      packId: true,
    },
  });
  if (!purchase) return false;
  if (purchase.status === ShopGoogleShoppingPurchaseStatus.paid) return true;
  if (purchase.status !== ShopGoogleShoppingPurchaseStatus.pending) return false;

  if (
    stripe.paidAmountCents !== undefined &&
    stripe.paidAmountCents !== purchase.amountCents
  ) {
    return false;
  }

  const creditsToGrant =
    purchase.packId === GOOGLE_SHOPPING_LEGACY_PACK_ID
      ? LEGACY_GOOGLE_SHOPPING_ACCESS_CREDITS
      : purchase.creditsGranted;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.shopGoogleShoppingPurchase.updateMany({
      where: {
        id: purchaseId,
        status: ShopGoogleShoppingPurchaseStatus.pending,
      },
      data: {
        status: ShopGoogleShoppingPurchaseStatus.paid,
        paidAt: new Date(),
        stripePaymentIntentId: stripe.paymentIntentId,
      },
    });
    if (updated.count === 0) return;

    await tx.shop.update({
      where: { id: purchase.shopId },
      data: {
        googleShoppingCredits: { increment: creditsToGrant },
      },
    });
  });

  const after = await prisma.shopGoogleShoppingPurchase.findUnique({
    where: { id: purchaseId },
    select: { status: true },
  });
  if (after?.status !== ShopGoogleShoppingPurchaseStatus.paid) return false;

  revalidatePath("/dashboard");
  revalidateShopUpgradesDashboardPaths();
  revalidatePath("/admin");
  return true;
}
