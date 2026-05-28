/** Minimum voluntary tip (USD cents). */
const MIN_SUPPORT_TIP_CENTS = 100;
/** Upper bound for voluntary tip (USD cents); avoids absurd Checkout amounts. */
const MAX_SUPPORT_TIP_CENTS = 99_999_00;

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

export function isSupportCheckoutConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}
