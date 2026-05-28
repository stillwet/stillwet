"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { revalidateShopUpgradesDashboardPaths } from "@/lib/dashboard-revalidate-shop-upgrades";
import { ShopGoogleShoppingPurchaseStatus } from "@/generated/prisma/enums";
import { isMockCheckoutEnabled } from "@/lib/checkout-mock";
import { googleShoppingCreditPackById } from "@/lib/google-shopping-credit-packs";
import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { fulfillShopGoogleShoppingPurchaseIfPending } from "@/lib/shop-google-shopping-fulfillment";
import { assignGoogleShoppingCreditsToListings } from "@/lib/shop-google-shopping-enrollment";
import { getShopOwnerSession } from "@/lib/session";
import { paymentIntentStartErrorMessage } from "@/lib/payment-intent-start-error";
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

export type DashboardGoogleShoppingActionResult =
  | { ok: true; enrolledCount?: number }
  | { ok: false; error: string };

export type StartShopGoogleShoppingPackPaymentIntentResult =
  | { ok: true; clientSecret: string; purchaseId: string }
  | { ok: false; error: string };

export async function startShopGoogleShoppingPackPaymentIntent(
  packId: string,
): Promise<StartShopGoogleShoppingPackPaymentIntentResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }

  const pack = googleShoppingCreditPackById(packId);
  if (!pack) return { ok: false, error: "Invalid Google Shopping pack." };

  if (isMockCheckoutEnabled()) {
    return {
      ok: false,
      error: "Mock checkout is enabled — use the mock purchase button instead of card entry.",
    };
  }

  const purchase = await prisma.shopGoogleShoppingPurchase.create({
    data: {
      shopId: shop.id,
      shopUserId: user.id,
      packId: pack.id,
      creditsGranted: pack.credits,
      amountCents: pack.priceCents,
      currency: "usd",
      status: ShopGoogleShoppingPurchaseStatus.pending,
    },
  });

  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: pack.priceCents,
      currency: "usd",
      payment_method_types: ["card"],
      metadata: {
        kind: "shop_google_shopping_pack",
        purchaseId: purchase.id,
        shopId: shop.id,
        packId: pack.id,
        creditsGranted: String(pack.credits),
        amountCents: String(pack.priceCents),
      },
    });

    const clientSecret = paymentIntent.client_secret;
    if (!clientSecret) {
      await prisma.shopGoogleShoppingPurchase.update({
        where: { id: purchase.id },
        data: { status: ShopGoogleShoppingPurchaseStatus.failed },
      });
      return { ok: false, error: "Stripe did not return a client secret." };
    }

    await prisma.shopGoogleShoppingPurchase.update({
      where: { id: purchase.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    return { ok: true, clientSecret, purchaseId: purchase.id };
  } catch (e) {
    console.error("[startShopGoogleShoppingPackPaymentIntent]", e);
    await prisma.shopGoogleShoppingPurchase.update({
      where: { id: purchase.id },
      data: { status: ShopGoogleShoppingPurchaseStatus.failed },
    });
    return { ok: false, error: paymentIntentStartErrorMessage(e) };
  }
}

export type FinalizeShopGoogleShoppingPackPaymentIntentResult =
  | { ok: true }
  | { ok: false; error: string };

export async function finalizeShopGoogleShoppingPackPaymentIntent(
  paymentIntentId: string,
): Promise<FinalizeShopGoogleShoppingPackPaymentIntentResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }

  const piId = paymentIntentId.trim();
  if (!piId) return { ok: false, error: "Missing payment confirmation." };

  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(piId);

  const kind = pi.metadata?.kind;
  if (kind !== "shop_google_shopping_pack" && kind !== "shop_google_shopping_access") {
    return { ok: false, error: "This payment is not a Google Shopping purchase." };
  }
  const metaShopId = pi.metadata.shopId;
  if (metaShopId && metaShopId !== shop.id) {
    return { ok: false, error: "This payment does not belong to your shop." };
  }

  const purchaseId = pi.metadata.purchaseId;
  if (!purchaseId) return { ok: false, error: "Invalid payment metadata." };

  const purchase = await prisma.shopGoogleShoppingPurchase.findFirst({
    where: { id: purchaseId, shopId: shop.id },
    select: { id: true, status: true, amountCents: true },
  });
  if (!purchase) return { ok: false, error: "Purchase not found." };
  if (purchase.status === ShopGoogleShoppingPurchaseStatus.paid) return { ok: true };

  if (pi.status !== "succeeded") {
    return { ok: false, error: `Payment is not complete yet (status: ${pi.status}).` };
  }
  if (pi.amount !== purchase.amountCents) {
    return { ok: false, error: "Payment amount does not match this pack price." };
  }

  const fulfilled = await fulfillShopGoogleShoppingPurchaseIfPending(purchaseId, {
    paymentIntentId: pi.id,
    paidAmountCents: pi.amount,
  });
  if (!fulfilled) {
    return { ok: false, error: "Could not grant Google Shopping credits for this payment." };
  }
  return { ok: true };
}

export async function mockPurchaseShopGoogleShoppingPack(
  packId: string,
): Promise<DashboardGoogleShoppingActionResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }
  if (!isMockCheckoutEnabled()) {
    return { ok: false, error: "Mock checkout is not enabled." };
  }

  const pack = googleShoppingCreditPackById(packId);
  if (!pack) return { ok: false, error: "Invalid Google Shopping pack." };

  const purchase = await prisma.shopGoogleShoppingPurchase.create({
    data: {
      shopId: shop.id,
      shopUserId: user.id,
      packId: pack.id,
      creditsGranted: pack.credits,
      amountCents: pack.priceCents,
      currency: "usd",
      status: ShopGoogleShoppingPurchaseStatus.pending,
    },
  });

  const fulfilled = await fulfillShopGoogleShoppingPurchaseIfPending(purchase.id, {
    paymentIntentId: `mock_shop_google_shopping_${purchase.id}`,
    paidAmountCents: pack.priceCents,
  });
  if (!fulfilled) {
    return { ok: false, error: "Could not grant Google Shopping credits." };
  }
  revalidatePath("/dashboard");
  revalidateShopUpgradesDashboardPaths();
  return { ok: true };
}

export async function assignGoogleShoppingListings(
  listingIds: string[],
): Promise<DashboardGoogleShoppingActionResult> {
  const user = await requireShopOwner();
  const shop = user.shop;
  if (shop.slug === PLATFORM_SHOP_SLUG) {
    return { ok: false, error: "Not available for the platform catalog shop." };
  }

  const result = await assignGoogleShoppingCreditsToListings(shop.id, user.id, listingIds);
  if (!result.ok) return result;

  revalidateShopUpgradesDashboardPaths();
  return { ok: true, enrolledCount: result.enrolledCount };
}
