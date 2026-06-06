"use server";

import { redirect } from "next/navigation";
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
            name: "Support the site",
            description: "Voluntary tip — thank you for helping keep this marketplace running.",
          },
        },
      },
      ...(processingLine ? [processingLine] : []),
    ],
    metadata: {
      kind: "support_tip",
      subtotalCents: String(cents),
      paymentProcessingCents: String(buyerPaymentProcessingFeeCents({ subtotalCents: cents })),
    },
    success_url: `${base.replace(/\/$/, "")}/support-thanks`,
    cancel_url: `${base.replace(/\/$/, "")}/?support=cancelled`,
  });

  if (!session.url) redirect("/?support=unavailable");
  redirect(session.url);
}
