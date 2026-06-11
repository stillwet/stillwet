"use server";

import { redirect } from "next/navigation";
import { getAdminSessionReadonly } from "@/lib/session";
import { getStripe } from "@/lib/stripe";

export type AdminMerchandiseConnectTransferLookupResult =
  | { ok: true; stripeShopTransferCents: number }
  | { ok: false; error: string };

async function requireAdmin() {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) redirect("/admin/login");
}

/**
 * Admin-only: actual Stripe Connect shop transfer for a merchandise PaymentIntent
 * (`amount − application_fee_amount`).
 */
export async function adminMerchandiseConnectTransferLookup(
  stripePaymentIntentId: string | null | undefined,
): Promise<AdminMerchandiseConnectTransferLookupResult> {
  await requireAdmin();

  const id = stripePaymentIntentId?.trim();
  if (!id) {
    return { ok: false, error: "No payment intent on this order." };
  }

  try {
    const pi = await getStripe().paymentIntents.retrieve(id);
    const applicationFeeCents = Math.max(0, pi.application_fee_amount ?? 0);
    const stripeShopTransferCents = Math.max(0, pi.amount - applicationFeeCents);
    return { ok: true, stripeShopTransferCents };
  } catch (e) {
    console.error("[adminMerchandiseConnectTransferLookup]", e);
    return { ok: false, error: "Could not load Stripe payment intent." };
  }
}
