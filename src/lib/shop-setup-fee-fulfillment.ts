import type Stripe from "stripe";
import { Prisma } from "@/generated/prisma/client";
import { ShopSetupFeePurchaseStatus } from "@/generated/prisma/enums";
import { shopDisplayNameUniquenessKey } from "@/lib/shop-display-name-uniqueness";
import { issueShopEmailVerificationTokenAndSend } from "@/lib/shop-email-verification";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

function paymentIntentIdFromCheckoutSession(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent;
  if (typeof pi === "string") return pi;
  if (pi && typeof pi === "object" && "id" in pi) return String(pi.id);
  return null;
}

export type FinalizeShopSetupFeeResult =
  | { ok: true; shopUserId: string; newlyCreated: boolean }
  | { ok: false; error: string };

export async function finalizeShopSetupFeePurchase(
  purchaseId: string,
  payment: {
    stripeCheckoutSessionId?: string;
    stripePaymentIntentId?: string | null;
    paidAmountCents?: number;
  },
): Promise<FinalizeShopSetupFeeResult> {
  const purchase = await prisma.shopSetupFeePurchase.findUnique({
    where: { id: purchaseId },
    include: { pendingSignup: true },
  });
  if (!purchase) return { ok: false, error: "Setup fee purchase not found." };
  if (purchase.status === ShopSetupFeePurchaseStatus.paid && purchase.shopUserId) {
    return { ok: true, shopUserId: purchase.shopUserId, newlyCreated: false };
  }
  if (purchase.status !== ShopSetupFeePurchaseStatus.pending) {
    return { ok: false, error: "This setup fee purchase is no longer pending." };
  }
  if (payment.paidAmountCents !== undefined && payment.paidAmountCents !== purchase.amountCents) {
    return { ok: false, error: "Payment amount does not match the setup fee." };
  }

  const pending = purchase.pendingSignup;
  if (pending.consumedAt) {
    return { ok: false, error: "This signup has already been completed." };
  }
  if (pending.expiresAt.getTime() < Date.now()) {
    await prisma.shopSetupFeePurchase.update({
      where: { id: purchase.id },
      data: { status: ShopSetupFeePurchaseStatus.failed },
    });
    return { ok: false, error: "This setup checkout expired. Please start again." };
  }

  const result = await prisma.$transaction(async (tx) => {
    const lockedPurchase = await tx.shopSetupFeePurchase.findUnique({
      where: { id: purchase.id },
      include: { pendingSignup: true },
    });
    if (!lockedPurchase) return { status: "missing" as const };
    if (lockedPurchase.status === ShopSetupFeePurchaseStatus.paid && lockedPurchase.shopUserId) {
      return { status: "existing" as const, shopUserId: lockedPurchase.shopUserId };
    }
    if (
      lockedPurchase.status !== ShopSetupFeePurchaseStatus.pending ||
      lockedPurchase.pendingSignup.consumedAt ||
      lockedPurchase.pendingSignup.expiresAt.getTime() < Date.now()
    ) {
      return { status: "invalid" as const };
    }

    const emailTaken = await tx.shopUser.findUnique({
      where: { email: lockedPurchase.pendingSignup.email },
      select: { id: true },
    });
    if (emailTaken) return { status: "email_taken" as const };

    const displayKey = shopDisplayNameUniquenessKey(lockedPurchase.pendingSignup.displayName);
    if (displayKey) {
      const displayConflict = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM "Shop"
        WHERE LOWER(TRIM("displayName")) = ${displayKey}
        LIMIT 1
      `);
      if (displayConflict.length > 0) return { status: "display_taken" as const };
    }

    const shop = await tx.shop.create({
      data: {
        slug: lockedPurchase.pendingSignup.slug,
        displayName: lockedPurchase.pendingSignup.displayName,
        active: true,
      },
      select: { id: true },
    });
    const user = await tx.shopUser.create({
      data: {
        email: lockedPurchase.pendingSignup.email,
        passwordHash: lockedPurchase.pendingSignup.passwordHash,
        shopId: shop.id,
        lastLoginAt: new Date(),
      },
      select: { id: true, email: true },
    });
    await tx.pendingShopSignup.update({
      where: { id: lockedPurchase.pendingSignupId },
      data: { consumedAt: new Date() },
    });
    await tx.shopSetupFeePurchase.update({
      where: { id: lockedPurchase.id },
      data: {
        status: ShopSetupFeePurchaseStatus.paid,
        paidAt: new Date(),
        shopId: shop.id,
        shopUserId: user.id,
        ...(payment.stripeCheckoutSessionId
          ? { stripeCheckoutSessionId: payment.stripeCheckoutSessionId }
          : {}),
        ...(payment.stripePaymentIntentId
          ? { stripePaymentIntentId: payment.stripePaymentIntentId }
          : {}),
      },
    });
    return { status: "created" as const, shopUserId: user.id, email: user.email };
  });

  if (result.status === "existing") {
    return { ok: true, shopUserId: result.shopUserId, newlyCreated: false };
  }
  if (result.status !== "created") {
    const error =
      result.status === "email_taken"
        ? "That email is already registered."
        : result.status === "display_taken"
          ? "That shop name is already taken. Choose a different name."
          : "Could not complete this setup fee purchase.";
    return { ok: false, error };
  }

  const verifySend = await issueShopEmailVerificationTokenAndSend(result.shopUserId, result.email);
  if (!verifySend.ok) {
    console.error("[shop-setup-fee] verification email failed:", verifySend.error);
  }
  return { ok: true, shopUserId: result.shopUserId, newlyCreated: true };
}

export async function fulfillShopSetupFeeCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<boolean> {
  if (session.metadata?.kind !== "shop_setup_fee") return false;
  const purchaseId = session.metadata.purchaseId;
  if (!purchaseId || typeof purchaseId !== "string") return true;
  if (session.payment_status !== "paid") return true;
  await finalizeShopSetupFeePurchase(purchaseId, {
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentIdFromCheckoutSession(session),
    paidAmountCents:
      typeof session.amount_total === "number" && Number.isFinite(session.amount_total)
        ? session.amount_total
        : undefined,
  });
  return true;
}

export async function finalizeShopSetupFeeCheckoutSessionId(
  sessionId: string,
): Promise<FinalizeShopSetupFeeResult> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  if (session.metadata?.kind !== "shop_setup_fee") {
    return { ok: false, error: "This checkout is not a shop setup fee." };
  }
  if (session.payment_status !== "paid") {
    return { ok: false, error: "The setup fee payment is not complete yet." };
  }
  const purchaseId = session.metadata.purchaseId;
  if (!purchaseId || typeof purchaseId !== "string") {
    return { ok: false, error: "Setup checkout is missing purchase metadata." };
  }
  return finalizeShopSetupFeePurchase(purchaseId, {
    stripeCheckoutSessionId: sessionId,
    stripePaymentIntentId: paymentIntentIdFromCheckoutSession(session),
    paidAmountCents:
      typeof session.amount_total === "number" && Number.isFinite(session.amount_total)
        ? session.amount_total
        : undefined,
  });
}
