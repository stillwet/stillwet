import { revalidatePath } from "next/cache";
import { PromotionPurchaseStatus } from "@/generated/prisma/enums";
import { rebuildShopPromotionsDashboardSnapshot } from "@/lib/dashboard-scoped-data";
import { revalidateShopUpgradesDashboardPaths } from "@/lib/dashboard-revalidate-shop-upgrades";
import { prisma } from "@/lib/prisma";

/**
 * Marks a promotion purchase paid (Stripe webhook or embedded card confirmation). Idempotent for `paid`.
 */
export async function fulfillPromotionPurchasePaidIfPending(
  purchaseId: string,
  stripe: {
    paymentIntentId: string;
    chargeId?: string | null;
    /** When set (e.g. from PaymentIntent.amount), must match the row amount. */
    paidAmountCents?: number;
  },
): Promise<boolean> {
  const purchase = await prisma.promotionPurchase.findUnique({
    where: { id: purchaseId },
    select: { id: true, shopId: true, status: true, amountCents: true, paidViaPromotionCredit: true },
  });
  if (!purchase) return false;
  if (purchase.status === PromotionPurchaseStatus.paid) return true;
  if (purchase.status !== PromotionPurchaseStatus.pending) return false;

  if (
    stripe.paidAmountCents !== undefined &&
    stripe.paidAmountCents !== purchase.amountCents
  ) {
    return false;
  }

  await prisma.promotionPurchase.update({
    where: { id: purchaseId },
    data: {
      status: PromotionPurchaseStatus.paid,
      paidAt: new Date(),
      stripePaymentIntentId: stripe.paymentIntentId,
      stripeChargeId: stripe.chargeId ?? null,
    },
  });
  void rebuildShopPromotionsDashboardSnapshot(purchase.shopId).catch(() => {});
  revalidatePath("/dashboard");
  revalidateShopUpgradesDashboardPaths();
  return true;
}

/** Records a paid $0 promotion from an admin-granted credit (no Stripe). */
export async function fulfillPromotionPurchaseFromCredit(args: {
  shopId: string;
  shopSlug?: string;
}): Promise<void> {
  void rebuildShopPromotionsDashboardSnapshot(args.shopId, args.shopSlug).catch(() => {});
  revalidatePath("/dashboard");
  revalidateShopUpgradesDashboardPaths();
}
