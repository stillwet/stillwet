import { revalidatePath } from "next/cache";
import { ListingCreditPackPurchaseStatus } from "@/generated/prisma/enums";
import { revalidateShopUpgradesDashboardPaths } from "@/lib/dashboard-revalidate-shop-upgrades";
import { syncFreeListingFeeWaivers } from "@/lib/listing-fee";
import { prisma } from "@/lib/prisma";

/**
 * Marks a listing credit pack purchase paid and grants credits. Idempotent for `paid`.
 */
export async function fulfillListingCreditPackPurchaseIfPending(
  purchaseId: string,
  stripe: {
    paymentIntentId: string;
    paidAmountCents?: number;
  },
): Promise<boolean> {
  const purchase = await prisma.listingCreditPackPurchase.findUnique({
    where: { id: purchaseId },
    select: {
      id: true,
      shopId: true,
      status: true,
      amountCents: true,
      creditsGranted: true,
    },
  });
  if (!purchase) return false;
  if (purchase.status === ListingCreditPackPurchaseStatus.paid) return true;
  if (purchase.status !== ListingCreditPackPurchaseStatus.pending) return false;

  if (
    stripe.paidAmountCents !== undefined &&
    stripe.paidAmountCents !== purchase.amountCents
  ) {
    return false;
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.listingCreditPackPurchase.updateMany({
      where: {
        id: purchaseId,
        status: ListingCreditPackPurchaseStatus.pending,
      },
      data: {
        status: ListingCreditPackPurchaseStatus.paid,
        paidAt: new Date(),
        stripePaymentIntentId: stripe.paymentIntentId,
      },
    });
    if (updated.count === 0) return;

    await tx.shop.update({
      where: { id: purchase.shopId },
      data: {
        listingFeeBonusFreeSlots: { increment: purchase.creditsGranted },
      },
    });
  });

  const after = await prisma.listingCreditPackPurchase.findUnique({
    where: { id: purchaseId },
    select: { status: true, shopId: true, creditsGranted: true },
  });
  if (after?.status !== ListingCreditPackPurchaseStatus.paid) return false;

  await syncFreeListingFeeWaivers(after.shopId);

  const n = after.creditsGranted;
  const body =
    n === 1 ? "You purchased 1 listing credit." : `You purchased ${n} listing credits.`;

  await prisma.shopOwnerNotice.create({
    data: {
      shopId: after.shopId,
      kind: "listing_credit_pack_paid",
      body,
    },
  });

  revalidatePath("/dashboard");
  revalidateShopUpgradesDashboardPaths();
  return true;
}
