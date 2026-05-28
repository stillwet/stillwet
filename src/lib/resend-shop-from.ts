import { BRAND_MERCH_NAME, SITE_EMAIL_SUBDOMAIN_EXAMPLE, brandMerchEmailFrom } from "@/lib/site-brand";

/** Resend test sender — only reliable to your own verified recipients. */
export const RESEND_DEV_FALLBACK_FROM = `${BRAND_MERCH_NAME} <onboarding@resend.dev>`;

const PLACEHOLDER_EMAIL_DOMAINS = new Set([
  "yourdomain.com",
  "example.com",
  "example.org",
]);

function domainFromResendFromHeader(from: string): string | null {
  const match = from.match(/<([^>]+)>/);
  const addr = (match?.[1] ?? from).trim();
  const at = addr.lastIndexOf("@");
  if (at < 0) return null;
  return addr.slice(at + 1).toLowerCase();
}

function isPlaceholderFromDomain(from: string): boolean {
  const domain = domainFromResendFromHeader(from);
  if (!domain) return false;
  return PLACEHOLDER_EMAIL_DOMAINS.has(domain);
}

export type ShopTransactionalFromResult =
  | { ok: true; from: string }
  | { ok: false; error: string };

/**
 * Picks the first configured shop transactional From address that is not a template placeholder.
 * Production requires a verified domain in Resend (see SHOP_PASSWORD_RESET_EMAIL_FROM in .env.example).
 */
export function resolveShopTransactionalEmailFrom(
  candidates: Array<string | undefined>,
): ShopTransactionalFromResult {
  for (const raw of candidates) {
    const v = raw?.trim();
    if (!v) continue;
    if (isPlaceholderFromDomain(v)) {
      console.warn(
        `[resend] Ignoring placeholder From "${v}". Set SHOP_PASSWORD_RESET_EMAIL_FROM or SHOP_EMAIL_VERIFICATION_EMAIL_FROM to a Resend-verified address (e.g. ${brandMerchEmailFrom()}).`,
      );
      continue;
    }
    return { ok: true, from: v };
  }

  if (process.env.NODE_ENV === "production") {
    return {
      ok: false,
      error: `Email sender is not configured for production. In Vercel, set SHOP_PASSWORD_RESET_EMAIL_FROM to a Resend-verified address (e.g. ${brandMerchEmailFrom()}). Add and verify the domain at https://resend.com/domains.`,
    };
  }

  return { ok: true, from: RESEND_DEV_FALLBACK_FROM };
}
