"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ShopFlairPurchaseStatus } from "@/generated/prisma/enums";
import { isMockCheckoutEnabled } from "@/lib/checkout-mock";
import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { fulfillShopFlairPurchaseIfPending } from "@/lib/shop-flair-fulfillment";
import { SHOP_FLAIR_ACCESS_PRICE_CENTS } from "@/lib/shop-flair";
import { getShopOwnerSession } from "@/lib/session";
import { paymentIntentStartErrorMessage } from "@/lib/payment-intent-start-error";
import { getStripe } from "@/lib/stripe";
import { buyerPaymentProcessingFeeCents } from "@/lib/stripe-card-processing-fee";

async function requireShopOwner() {
  const session = await getShopOwnerSession();
  if (!session.shopUserId) redirect("/dashboard/login");
  const user = await prisma.shopUser.findUnique({
    where: { id: session.shopUserId },
    include: { shop: true },
  });
  if (!user) {
    session.destroy();
    redirect("/dashboard/login");
  }
  return user;
}

export type DashboardFlairActionResult = { ok: true } | { ok: false; error: string };

export type StartShopFlairAccessPaymentIntentResult =
  | { ok: true; clientSecret: string; purchaseId: string }
  | { ok: false; error: string };

export async function startShopFlairAccessPaymentIntent(): Promise<StartShopFlairAccessPaymentIntentResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }
  if (shop.flairPurchasedAt) {
    return { ok: false, error: "Shop flair access is already purchased." };
  }

  if (isMockCheckoutEnabled()) {
    return {
      ok: false,
      error: "Mock checkout is enabled — use the mock purchase button instead of card entry.",
    };
  }

  const subtotalCents = SHOP_FLAIR_ACCESS_PRICE_CENTS;
  const paymentProcessingCents = buyerPaymentProcessingFeeCents({ subtotalCents });
  const chargeCents = subtotalCents + paymentProcessingCents;

  const purchase = await prisma.shopFlairPurchase.create({
    data: {
      shopId: shop.id,
      shopUserId: user.id,
      amountCents: chargeCents,
      currency: "usd",
      status: ShopFlairPurchaseStatus.pending,
    },
  });

  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: chargeCents,
      currency: "usd",
      payment_method_types: ["card"],
      metadata: {
        kind: "shop_flair_access",
        purchaseId: purchase.id,
        shopId: shop.id,
        subtotalCents: String(subtotalCents),
        paymentProcessingCents: String(paymentProcessingCents),
        amountCents: String(chargeCents),
      },
    });

    const clientSecret = paymentIntent.client_secret;
    if (!clientSecret) {
      await prisma.shopFlairPurchase.update({
        where: { id: purchase.id },
        data: { status: ShopFlairPurchaseStatus.failed },
      });
      return { ok: false, error: "Stripe did not return a client secret." };
    }

    await prisma.shopFlairPurchase.update({
      where: { id: purchase.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    return { ok: true, clientSecret, purchaseId: purchase.id };
  } catch (e) {
    console.error("[startShopFlairAccessPaymentIntent]", e);
    await prisma.shopFlairPurchase.update({
      where: { id: purchase.id },
      data: { status: ShopFlairPurchaseStatus.failed },
    });
    return { ok: false, error: paymentIntentStartErrorMessage(e) };
  }
}

export type FinalizeShopFlairAccessPaymentIntentResult =
  | { ok: true }
  | { ok: false; error: string };

export async function finalizeShopFlairAccessPaymentIntent(
  paymentIntentId: string,
): Promise<FinalizeShopFlairAccessPaymentIntentResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }

  const piId = paymentIntentId.trim();
  if (!piId) return { ok: false, error: "Missing payment confirmation." };

  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(piId);

  if (pi.metadata?.kind !== "shop_flair_access") {
    return { ok: false, error: "This payment is not a shop flair purchase." };
  }
  const metaShopId = pi.metadata.shopId;
  if (metaShopId && metaShopId !== shop.id) {
    return { ok: false, error: "This payment does not belong to your shop." };
  }

  const purchaseId = pi.metadata.purchaseId;
  if (!purchaseId) return { ok: false, error: "Invalid payment metadata." };

  const purchase = await prisma.shopFlairPurchase.findFirst({
    where: { id: purchaseId, shopId: shop.id },
    select: { id: true, status: true, amountCents: true },
  });
  if (!purchase) return { ok: false, error: "Purchase not found." };
  if (purchase.status === ShopFlairPurchaseStatus.paid) return { ok: true };

  if (pi.status !== "succeeded") {
    return { ok: false, error: `Payment is not complete yet (status: ${pi.status}).` };
  }
  if (pi.amount !== purchase.amountCents) {
    return { ok: false, error: "Payment amount does not match the flair price." };
  }

  const fulfilled = await fulfillShopFlairPurchaseIfPending(purchaseId, {
    paymentIntentId: pi.id,
    paidAmountCents: pi.amount,
  });
  if (!fulfilled) {
    return { ok: false, error: "Could not unlock shop flair for this payment." };
  }
  return { ok: true };
}

export async function mockPurchaseShopFlairAccess(): Promise<DashboardFlairActionResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }
  if (!isMockCheckoutEnabled()) {
    return { ok: false, error: "Mock checkout is not enabled." };
  }
  if (shop.flairPurchasedAt) {
    return { ok: false, error: "Shop flair access is already purchased." };
  }

  const purchase = await prisma.shopFlairPurchase.create({
    data: {
      shopId: shop.id,
      shopUserId: user.id,
      amountCents: SHOP_FLAIR_ACCESS_PRICE_CENTS,
      currency: "usd",
      status: ShopFlairPurchaseStatus.pending,
    },
  });

  const fulfilled = await fulfillShopFlairPurchaseIfPending(purchase.id, {
    paymentIntentId: `mock_shop_flair_${purchase.id}`,
    paidAmountCents: SHOP_FLAIR_ACCESS_PRICE_CENTS,
  });
  if (!fulfilled) {
    return { ok: false, error: "Could not unlock shop flair." };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}

/** @deprecated Use mockPurchaseShopFlairAccess via ShopFlairAccessPay. */
export async function dashboardMockBuyFlairAccess(): Promise<DashboardFlairActionResult> {
  return mockPurchaseShopFlairAccess();
}

export async function dashboardSetShopFlairType(
  formData: FormData,
): Promise<DashboardFlairActionResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }
  if (!shop.flairPurchasedAt) {
    return { ok: false, error: "Purchase flair access before selecting a flair." };
  }

  const parsed = z
    .object({
      flairTypeId: z.string().trim().optional(),
    })
    .safeParse({ flairTypeId: formData.get("flairTypeId") });
  if (!parsed.success) return { ok: false, error: "Invalid selection." };

  const id = parsed.data.flairTypeId?.trim() || "";
  if (!id) {
    await prisma.shop.update({ where: { id: shop.id }, data: { flairTypeId: null } });
    revalidatePath("/dashboard");
    return { ok: true };
  }

  const type = await prisma.shopFlairType.findFirst({
    where: { id, active: true },
    select: { id: true },
  });
  if (!type) return { ok: false, error: "That flair type is not available." };

  await prisma.shop.update({ where: { id: shop.id }, data: { flairTypeId: type.id } });
  revalidatePath("/dashboard");
  return { ok: true };
}
