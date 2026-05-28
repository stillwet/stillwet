"use server";

import { CreatorGiftPurchaseStatus } from "@/generated/prisma/enums";
import { SHOP_SETUP_FEE_CENTS, SHOP_SETUP_FEE_LABEL } from "@/lib/creator-gift-codes";
import { listingCreditPackById } from "@/lib/listing-credit-packs";
import { prisma } from "@/lib/prisma";
import { publicAppBaseUrl } from "@/lib/public-app-url";
import { getStripe } from "@/lib/stripe";
import {
  buyerCheckoutTotalCents,
  stripeCheckoutProcessingFeeLineItem,
} from "@/lib/stripe-card-processing-fee";

export type StartCreatorGiftCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function startCreatorGiftCheckout(
  _prev: StartCreatorGiftCheckoutResult | undefined,
  formData: FormData,
): Promise<StartCreatorGiftCheckoutResult> {
  const purchaserEmail = String(formData.get("purchaserEmail") ?? "").trim().toLowerCase();
  const includeSetup = String(formData.get("includeSetup") ?? "") === "on";
  const packId = String(formData.get("listingCreditPackId") ?? "").trim();
  const pack = packId ? listingCreditPackById(packId) : null;

  if (!purchaserEmail || !purchaserEmail.includes("@")) {
    return { ok: false, error: "Enter a valid email for the gift codes." };
  }
  if (packId && !pack) {
    return { ok: false, error: "Choose a valid listing credit pack." };
  }
  if (!includeSetup && !pack) {
    return { ok: false, error: "Choose the shop setup gift, a listing credit pack, or both." };
  }

  const base = publicAppBaseUrl();
  if (!base) return { ok: false, error: "App URL is not configured." };

  const merchandiseSubtotalCents =
    (includeSetup ? SHOP_SETUP_FEE_CENTS : 0) + (pack?.priceCents ?? 0);
  if (merchandiseSubtotalCents <= 0) {
    return { ok: false, error: "Gift amount must be greater than $0." };
  }
  const checkoutTotalCents = buyerCheckoutTotalCents(merchandiseSubtotalCents);
  const processingLine = stripeCheckoutProcessingFeeLineItem(merchandiseSubtotalCents);

  const purchase = await prisma.creatorGiftPurchase.create({
    data: {
      purchaserEmail,
      setupFeeIncluded: includeSetup,
      listingCreditPackId: pack?.id ?? null,
      listingCreditsGranted: pack?.credits ?? 0,
      amountCents: checkoutTotalCents,
      currency: "usd",
      status: CreatorGiftPurchaseStatus.pending,
    },
    select: { id: true },
  });

  try {
    const appBase = base.replace(/\/$/, "");
    const lineItems = [];
    if (includeSetup) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: SHOP_SETUP_FEE_CENTS,
          product_data: {
            name: SHOP_SETUP_FEE_LABEL,
            description: "Gift code for a creator's one-time shop setup account fee.",
          },
        },
      });
    }
    if (pack) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: pack.priceCents,
          product_data: {
            name: `${pack.credits} listing credits`,
            description: "Gift code for creator listing credits.",
          },
        },
      });
    }
    if (processingLine) lineItems.push(processingLine);

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: purchaserEmail,
      line_items: lineItems,
      metadata: {
        kind: "creator_gift",
        purchaseId: purchase.id,
        setupFeeIncluded: includeSetup ? "1" : "0",
        listingCreditPackId: pack?.id ?? "",
        listingCreditsGranted: String(pack?.credits ?? 0),
        subtotalCents: String(merchandiseSubtotalCents),
        amountCents: String(checkoutTotalCents),
      },
      success_url: `${appBase}/gift-creator/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBase}/gift-creator?gift=cancel`,
    });

    if (!session.url) {
      await prisma.creatorGiftPurchase.update({
        where: { id: purchase.id },
        data: { status: CreatorGiftPurchaseStatus.failed },
      });
      return { ok: false, error: "Stripe did not return a checkout URL." };
    }

    await prisma.creatorGiftPurchase.update({
      where: { id: purchase.id },
      data: { stripeCheckoutSessionId: session.id },
    });
    return { ok: true, url: session.url };
  } catch (e) {
    console.error("[gift-creator] checkout failed", e);
    await prisma.creatorGiftPurchase.update({
      where: { id: purchase.id },
      data: { status: CreatorGiftPurchaseStatus.failed },
    });
    return { ok: false, error: "Could not start gift checkout. Try again." };
  }
}
