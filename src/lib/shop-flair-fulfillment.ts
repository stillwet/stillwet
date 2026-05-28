import { revalidatePath } from "next/cache";
import { revalidateShopUpgradesDashboardPaths } from "@/lib/dashboard-revalidate-shop-upgrades";
import { ShopFlairPurchaseStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * Marks a shop flair access purchase paid and unlocks flair selection. Idempotent for `paid`.
 */
export async function fulfillShopFlairPurchaseIfPending(
  purchaseId: string,
  stripe: {
    paymentIntentId: string;
    paidAmountCents?: number;
  },
): Promise<boolean> {
  const purchase = await prisma.shopFlairPurchase.findUnique({
    where: { id: purchaseId },
    select: { id: true, shopId: true, status: true, amountCents: true },
  });
  if (!purchase) return false;
  if (purchase.status === ShopFlairPurchaseStatus.paid) return true;
  if (purchase.status !== ShopFlairPurchaseStatus.pending) return false;

  if (
    stripe.paidAmountCents !== undefined &&
    stripe.paidAmountCents !== purchase.amountCents
  ) {
    return false;
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.shopFlairPurchase.updateMany({
      where: {
        id: purchaseId,
        status: ShopFlairPurchaseStatus.pending,
      },
      data: {
        status: ShopFlairPurchaseStatus.paid,
        paidAt: now,
        stripePaymentIntentId: stripe.paymentIntentId,
      },
    });
    if (updated.count === 0) return;

    const shop = await tx.shop.findUnique({
      where: { id: purchase.shopId },
      select: { flairPurchasedAt: true },
    });
    if (!shop) return;

    await tx.shop.update({
      where: { id: purchase.shopId },
      data: { flairPurchasedAt: shop.flairPurchasedAt ?? now },
    });
  });

  const after = await prisma.shopFlairPurchase.findUnique({
    where: { id: purchaseId },
    select: { status: true },
  });
  if (after?.status !== ShopFlairPurchaseStatus.paid) return false;

  revalidatePath("/dashboard");
  revalidateShopUpgradesDashboardPaths();
  return true;
}
