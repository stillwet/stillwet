"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  PLATFORM_TRANSACTION_PRODUCT,
  allocatePlatformTransactionNumber,
  stripePlatformTransactionReferenceFields,
} from "@/lib/platform-transaction-reference";
import { getStripe } from "@/lib/stripe";
import { publicAppBaseUrl } from "@/lib/public-app-url";
import { normalizeSupportTipUsdToCents } from "@/lib/support-site";
import {
  buyerPaymentProcessingFeeCents,
  stripeCheckoutPaymentProcessingLineItem,
} from "@/lib/stripe-card-processing-fee";

/**
 * Starts a one-time Stripe Checkout for a voluntary site tip (platform revenue, not a shop payout).
 * Amount comes from form field `tipUsd` (dollars; minimum $1.00 USD).
 */
export async function startSupportSiteCheckout(formData: FormData) {
  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch {
    redirect("/?support=unavailable");
  }

  const base = publicAppBaseUrl();
  if (!base) redirect("/?support=unavailable");

  const cents = normalizeSupportTipUsdToCents(formData.get("tipUsd"));
  if (cents == null) redirect("/?support=invalid");

  const processingLine = stripeCheckoutPaymentProcessingLineItem({ subtotalCents: cents });

  const { tipId, refFields } = await prisma.$transaction(async (tx) => {
    const transactionNumber = await allocatePlatformTransactionNumber(
      tx,
      PLATFORM_TRANSACTION_PRODUCT.support_platform,
    );
    const fields = stripePlatformTransactionReferenceFields(
      PLATFORM_TRANSACTION_PRODUCT.support_platform,
      transactionNumber,
    );
    const tip = await tx.supportTip.create({
      data: {
        transactionNumber,
        amountCents: cents,
        currency: "usd",
      },
      select: { id: true },
    });
    return { tipId: tip.id, refFields: fields };
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: cents,
          product_data: {
            name: refFields.lineItemName,
            description: "Voluntary tip — thank you for helping keep this marketplace running.",
          },
        },
      },
      ...(processingLine ? [processingLine] : []),
    ],
    metadata: {
      kind: "support_tip",
      supportTipId: tipId,
      subtotalCents: String(cents),
      paymentProcessingCents: String(buyerPaymentProcessingFeeCents({ subtotalCents: cents })),
      ...refFields.metadata,
    },
    payment_intent_data: {
      description: refFields.description,
      metadata: refFields.metadata,
    },
    success_url: `${base.replace(/\/$/, "")}/support-thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base.replace(/\/$/, "")}/?support=cancelled`,
  });

  if (!session.url) redirect("/?support=unavailable");

  await prisma.supportTip.update({
    where: { id: tipId },
    data: { stripeCheckoutSessionId: session.id },
  });

  redirect(session.url);
}
