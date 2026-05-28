import type Stripe from "stripe";

export type StripeConnectShopFlags = {
  connectChargesEnabled: boolean;
  payoutsEnabled: boolean;
};

export function stripeConnectFlagsFromAccount(
  account: Pick<Stripe.Account, "charges_enabled" | "payouts_enabled">,
): StripeConnectShopFlags {
  return {
    connectChargesEnabled: account.charges_enabled === true,
    payoutsEnabled: account.payouts_enabled === true,
  };
}

function humanizeStripeRequirementField(field: string): string {
  const map: Record<string, string> = {
    "individual.id_number": "identity (SSN)",
    "individual.verification.document": "ID document",
    external_account: "bank account",
    "tos_acceptance.date": "terms acceptance",
    "business_profile.url": "business website",
  };
  return map[field] ?? field.replace(/\./g, " ").replace(/_/g, " ");
}

/** Shown when a Connect account exists but charges/payouts are not enabled yet. */
export function stripeConnectActivationHint(account: Stripe.Account): string | null {
  if (account.charges_enabled && account.payouts_enabled) {
    return null;
  }

  const req = account.requirements;
  const currentlyDue = req?.currently_due ?? [];
  const pastDue = req?.past_due ?? [];
  const disabledReason = req?.disabled_reason;

  if (currentlyDue.length > 0 || pastDue.length > 0) {
    const fields = [...new Set([...pastDue, ...currentlyDue])].slice(0, 6);
    const total = new Set([...pastDue, ...currentlyDue]).size;
    const list = fields.map(humanizeStripeRequirementField).join(", ");
    const more = total - fields.length;
    return `Stripe still needs: ${list}${more > 0 ? ` (+${more} more)` : ""}. Use Continue Stripe onboarding below.`;
  }

  if (disabledReason) {
    return `Stripe restricted this account (${disabledReason}). Use Continue Stripe onboarding or open the connected account in your Stripe Dashboard.`;
  }

  if (account.details_submitted) {
    return "Stripe has your details but has not enabled charges or payouts yet (review or missing bank info). In test mode, use SSN 000-00-0000 and Stripe’s test bank numbers, then continue onboarding if prompted.";
  }

  return "Stripe onboarding is not finished. Use Continue Stripe onboarding below—in test mode use SSN 000-00-0000 and Stripe test bank details.";
}
