import { getStripe, isStripeSecretConfigured } from "@/lib/stripe";

export async function verifyOrderPaymentCardLast4(
  stripePaymentIntentId: string | null | undefined,
  enteredLast4: string,
): Promise<{ ok: true } | { ok: false }> {
  const last4 = enteredLast4.trim();
  if (!/^\d{4}$/.test(last4)) return { ok: false };
  const piId = stripePaymentIntentId?.trim();
  if (!piId) return { ok: false };
  if (!isStripeSecretConfigured()) {
    if (process.env.NODE_ENV === "development") return { ok: true };
    return { ok: false };
  }

  try {
    const stripe = getStripe();
    const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
    const charge = pi.latest_charge;
    if (!charge || typeof charge === "string") return { ok: false };
    const cardLast4 = charge.payment_method_details?.card?.last4;
    if (!cardLast4 || cardLast4 !== last4) return { ok: false };
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
