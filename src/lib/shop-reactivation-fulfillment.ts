import type Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { ShopReactivationPurchaseStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

function paymentIntentIdFromCheckoutSession(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent;
  if (typeof pi === "string") return pi;
  if (pi && typeof pi === "object" && "id" in pi) return String(pi.id);
  return null;
}

export type FinalizeShopReactivationResult =
  | { ok: true; shopUserId: string; newlyReactivated: boolean }
  | { ok: false; error: string };

export async function finalizeShopReactivationPurchase(
  purchaseId: string,
  payment: {
    stripeCheckoutSessionId?: string;
    stripePaymentIntentId?: string | null;
    paidAmountCents?: number;
  },
): Promise<FinalizeShopReactivationResult> {
  const purchase = await prisma.shopReactivationPurchase.findUnique({
    where: { id: purchaseId },
    include: { shop: true },
  });
  if (!purchase) return { ok: false, error: "Reactivation purchase was not found." };
  if (purchase.status === ShopReactivationPurchaseStatus.paid) {
    return { ok: true, shopUserId: purchase.shopUserId, newlyReactivated: false };
  }
  if (purchase.status !== ShopReactivationPurchaseStatus.pending) {
    return { ok: false, error: "This reactivation purchase is no longer pending." };
  }
  if (payment.paidAmountCents !== undefined && payment.paidAmountCents !== purchase.amountCents) {
    return { ok: false, error: "Payment amount does not match the reactivation fee." };
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.shopReactivationPurchase.updateMany({
      where: { id: purchase.id, status: ShopReactivationPurchaseStatus.pending },
      data: {
        status: ShopReactivationPurchaseStatus.paid,
        paidAt: new Date(),
        ...(payment.stripeCheckoutSessionId
          ? { stripeCheckoutSessionId: payment.stripeCheckoutSessionId }
          : {}),
        ...(payment.stripePaymentIntentId
          ? { stripePaymentIntentId: payment.stripePaymentIntentId }
          : {}),
      },
    });
    if (updated.count === 0) return { changed: false };
    await tx.shop.update({
      where: { id: purchase.shopId },
      data: {
        inactivityWarningSentAt: null,
        inactivityDeactivatedAt: null,
        inactivityDeletionTriggeredAt: null,
        accountDeletionRequestedAt: null,
        accountDeletionEmailConfirmedAt: null,
      },
    });
    await tx.shopUser.update({
      where: { id: purchase.shopUserId },
      data: { lastLoginAt: new Date() },
    });
    return { changed: true };
  });

  revalidatePath("/dashboard");
  revalidatePath(`/s/${purchase.shop.slug}`);
  revalidatePath("/shops");
  return { ok: true, shopUserId: purchase.shopUserId, newlyReactivated: result.changed };
}

export async function fulfillShopReactivationCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<boolean> {
  if (session.metadata?.kind !== "shop_reactivation") return false;
  const purchaseId = session.metadata.purchaseId;
  if (!purchaseId || typeof purchaseId !== "string") return true;
  if (session.payment_status !== "paid") return true;
  await finalizeShopReactivationPurchase(purchaseId, {
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentIdFromCheckoutSession(session),
    paidAmountCents:
      typeof session.amount_total === "number" && Number.isFinite(session.amount_total)
        ? session.amount_total
        : undefined,
  });
  return true;
}

export async function finalizeShopReactivationCheckoutSessionId(
  sessionId: string,
): Promise<FinalizeShopReactivationResult> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  if (session.metadata?.kind !== "shop_reactivation") {
    return { ok: false, error: "This checkout is not a shop reactivation fee." };
  }
  if (session.payment_status !== "paid") {
    return { ok: false, error: "The reactivation payment is not complete yet." };
  }
  const purchaseId = session.metadata.purchaseId;
  if (!purchaseId || typeof purchaseId !== "string") {
    return { ok: false, error: "Reactivation checkout is missing purchase metadata." };
  }
  return finalizeShopReactivationPurchase(purchaseId, {
    stripeCheckoutSessionId: sessionId,
    stripePaymentIntentId: paymentIntentIdFromCheckoutSession(session),
    paidAmountCents:
      typeof session.amount_total === "number" && Number.isFinite(session.amount_total)
        ? session.amount_total
        : undefined,
  });
}
