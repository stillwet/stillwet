import {
  buyerCheckoutTotalCents,
  merchandiseSubtotalFromCheckoutTotalCents,
} from "@/lib/stripe-card-processing-fee";

/** Minimum voluntary tip (USD). */
export const MIN_SUPPORT_TIP_USD = 1;

/** Minimum voluntary tip (USD cents). */
const MIN_SUPPORT_TIP_CENTS = MIN_SUPPORT_TIP_USD * 100;
/** Upper bound for voluntary tip (USD cents); avoids absurd Checkout amounts. */
const MAX_SUPPORT_TIP_CENTS = 99_999_00;

function parseMetadataCents(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const parsed = parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Voluntary tip merchandise from a stored `SupportTip.amountCents`.
 * Legacy rows may store the full card charge; invert when it round-trips as checkout total.
 * Round-dollar stored amounts are treated as merchandise (user-entered tip), not legacy totals.
 */
export function supportTipMerchandiseCents(row: { amountCents: number }): number {
  const stored = Math.max(0, Math.round(row.amountCents));
  if (stored <= 0) return 0;

  const inverted = merchandiseSubtotalFromCheckoutTotalCents(stored);
  const isLegacyFullCharge =
    inverted > 0 &&
    inverted !== stored &&
    buyerCheckoutTotalCents(inverted) === stored;

  if (isLegacyFullCharge) {
    if (stored % 100 === 0) return stored;
    if (inverted % 100 === 0) return inverted;
  }
  return stored;
}

/** Merchandise tip amount from a paid Stripe Checkout session (metadata-first). */
export function supportTipMerchandiseCentsFromCheckoutSession(session: {
  amount_total?: number | null;
  metadata?: Record<string, string> | null;
}): number {
  const fromMetadata = parseMetadataCents(session.metadata?.subtotalCents);
  if (fromMetadata != null) return fromMetadata;

  const total =
    typeof session.amount_total === "number" && Number.isFinite(session.amount_total)
      ? session.amount_total
      : 0;
  if (total <= 0) return 0;
  return supportTipMerchandiseCents({ amountCents: total });
}

/**
 * Parses a voluntary tip entered as USD (e.g. form field `5` or `5.50`) into integer cents.
 * Returns null if missing, non-numeric, or outside allowed range.
 */
export function normalizeSupportTipUsdToCents(raw: unknown): number | null {
  const s = typeof raw === "string" ? raw.trim() : raw != null ? String(raw).trim() : "";
  if (!s) return null;
  const cleaned = s.replace(/,/g, "");
  const dollars = parseFloat(cleaned);
  if (!Number.isFinite(dollars)) return null;
  const cents = Math.round(dollars * 100);
  if (cents < MIN_SUPPORT_TIP_CENTS || cents > MAX_SUPPORT_TIP_CENTS) return null;
  return cents;
}

/** Client-side copy for support tip field validation (replaces browser-native bubbles). */
export function supportTipInputError(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : raw != null ? String(raw).trim() : "";
  if (!s) return "Enter an amount to continue.";
  if (normalizeSupportTipUsdToCents(raw) != null) return null;
  const cleaned = s.replace(/,/g, "");
  const dollars = parseFloat(cleaned);
  if (Number.isFinite(dollars) && Math.round(dollars * 100) < MIN_SUPPORT_TIP_CENTS) {
    return `Minimum tip is $${MIN_SUPPORT_TIP_USD.toFixed(2)}.`;
  }
  return "Enter a valid dollar amount.";
}

export function isSupportCheckoutConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}
