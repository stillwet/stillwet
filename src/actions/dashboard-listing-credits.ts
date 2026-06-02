"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ListingCreditPackPurchaseStatus } from "@/generated/prisma/enums";
import { isMockCheckoutEnabled } from "@/lib/checkout-mock";
import { fulfillListingCreditPackPurchaseIfPending } from "@/lib/listing-credit-pack-fulfillment";
import { listingCreditPackById } from "@/lib/listing-credit-packs";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSession } from "@/lib/session";
import { getStripe } from "@/lib/stripe";

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

export type StartListingCreditPackPaymentIntentResult =
  | { ok: true; clientSecret: string; purchaseId: string }
  | { ok: false; error: string };

export async function startListingCreditPackPaymentIntent(
  packId: string,
): Promise<StartListingCreditPackPaymentIntentResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }

  const pack = listingCreditPackById(packId);
  if (!pack) return { ok: false, error: "Invalid listing credit pack." };

  if (isMockCheckoutEnabled()) {
    return {
      ok: false,
      error: "Mock checkout is enabled — use the mock purchase button instead of card entry.",
    };
  }

  const purchase = await prisma.listingCreditPackPurchase.create({
    data: {
      shopId: shop.id,
      shopUserId: user.id,
      packId: pack.id,
      creditsGranted: pack.credits,
      amountCents: pack.priceCents,
      currency: "usd",
      status: ListingCreditPackPurchaseStatus.pending,
    },
  });

  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: pack.priceCents,
      currency: "usd",
      payment_method_types: ["card"],
      metadata: {
        kind: "listing_credit_pack",
        purchaseId: purchase.id,
        shopId: shop.id,
        packId: pack.id,
        creditsGranted: String(pack.credits),
        amountCents: String(pack.priceCents),
      },
    });

    const clientSecret = paymentIntent.client_secret;
    if (!clientSecret) {
      await prisma.listingCreditPackPurchase.update({
        where: { id: purchase.id },
        data: { status: ListingCreditPackPurchaseStatus.failed },
      });
      return { ok: false, error: "Stripe did not return a client secret." };
    }

    await prisma.listingCreditPackPurchase.update({
      where: { id: purchase.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    return { ok: true, clientSecret, purchaseId: purchase.id };
  } catch {
    await prisma.listingCreditPackPurchase.update({
      where: { id: purchase.id },
      data: { status: ListingCreditPackPurchaseStatus.failed },
    });
    return { ok: false, error: "Could not start payment. Try again." };
  }
}

export type FinalizeListingCreditPackPaymentIntentResult =
  | { ok: true }
  | { ok: false; error: string };

export async function finalizeListingCreditPackPaymentIntent(
  paymentIntentId: string,
): Promise<FinalizeListingCreditPackPaymentIntentResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }

  const piId = paymentIntentId.trim();
  if (!piId) return { ok: false, error: "Missing payment confirmation." };

  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(piId);

  if (pi.metadata?.kind !== "listing_credit_pack") {
    return { ok: false, error: "This payment is not a listing credit pack purchase." };
  }
  const metaShopId = pi.metadata.shopId;
  if (metaShopId && metaShopId !== shop.id) {
    return { ok: false, error: "This payment does not belong to your shop." };
  }

  const purchaseId = pi.metadata.purchaseId;
  if (!purchaseId) return { ok: false, error: "Invalid payment metadata." };

  const purchase = await prisma.listingCreditPackPurchase.findFirst({
    where: { id: purchaseId, shopId: shop.id },
    select: { id: true, status: true, amountCents: true },
  });
  if (!purchase) return { ok: false, error: "Purchase not found." };
  if (purchase.status === ListingCreditPackPurchaseStatus.paid) return { ok: true };

  if (pi.status !== "succeeded") {
    return { ok: false, error: `Payment is not complete yet (status: ${pi.status}).` };
  }
  if (pi.amount !== purchase.amountCents) {
    return { ok: false, error: "Payment amount does not match this pack price." };
  }

  const fulfilled = await fulfillListingCreditPackPurchaseIfPending(purchaseId, {
    paymentIntentId: pi.id,
    paidAmountCents: pi.amount,
  });
  if (!fulfilled) {
    return { ok: false, error: "Could not apply listing credits for this payment." };
  }
  return { ok: true };
}

export type MockPurchaseListingCreditPackResult = { ok: true } | { ok: false; error: string };

export async function mockPurchaseListingCreditPack(
  packId: string,
): Promise<MockPurchaseListingCreditPackResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }
  if (!isMockCheckoutEnabled()) {
    return { ok: false, error: "Mock checkout is not enabled." };
  }

  const pack = listingCreditPackById(packId);
  if (!pack) return { ok: false, error: "Invalid listing credit pack." };

  const purchase = await prisma.listingCreditPackPurchase.create({
    data: {
      shopId: shop.id,
      shopUserId: user.id,
      packId: pack.id,
      creditsGranted: pack.credits,
      amountCents: pack.priceCents,
      currency: "usd",
      status: ListingCreditPackPurchaseStatus.pending,
    },
  });

  const fulfilled = await fulfillListingCreditPackPurchaseIfPending(purchase.id, {
    paymentIntentId: `mock_lcp_${purchase.id}`,
    paidAmountCents: pack.priceCents,
  });
  if (!fulfilled) {
    return { ok: false, error: "Could not grant listing credits." };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}
