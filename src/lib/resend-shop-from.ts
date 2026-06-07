import { SITE_TRANSACTIONAL_EMAIL_FROM } from "@/lib/site-brand";
import { postResendEmailApi } from "@/lib/resend-api-client";

/** @deprecated Prefer SITE_TRANSACTIONAL_EMAIL_FROM. Resend test sender — limited deliverability. */
export const RESEND_DEV_FALLBACK_FROM = SITE_TRANSACTIONAL_EMAIL_FROM;

const PLACEHOLDER_EMAIL_DOMAINS = new Set([
  "yourdomain.com",
  "example.com",
  "example.org",
]);

/** Retired sending domains — skipped so env vars cannot resurrect old Resend config. */
const RETIRED_EMAIL_DOMAINS = new Set(["auto.stillwet.com"]);

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

function isRetiredFromDomain(from: string): boolean {
  const domain = domainFromResendFromHeader(from);
  if (!domain) return false;
  return RETIRED_EMAIL_DOMAINS.has(domain);
}

function shouldSkipTransactionalFrom(from: string): "placeholder" | "retired" | null {
  if (isPlaceholderFromDomain(from)) return "placeholder";
  if (isRetiredFromDomain(from)) return "retired";
  return null;
}

export type ShopTransactionalFromResult =
  | { ok: true; from: string }
  | { ok: false; error: string };

export type PostResendTransactionalEmailResult =
  | { ok: true; body: string; fromUsed: string }
  | { ok: false; status: number; body: string; fromUsed: string };

/**
 * Picks the first configured shop transactional From address that is not a template placeholder.
 * Always falls back to SITE_TRANSACTIONAL_EMAIL_FROM (Still Wet Merch <info@stillwet.com>).
 */
export function resolveShopTransactionalEmailFrom(
  candidates: Array<string | undefined>,
): ShopTransactionalFromResult {
  const chain = [...candidates, SITE_TRANSACTIONAL_EMAIL_FROM];
  for (const raw of chain) {
    const v = raw?.trim();
    if (!v) continue;
    const skip = shouldSkipTransactionalFrom(v);
    if (skip === "placeholder") {
      console.warn(
        `[resend] Ignoring placeholder From "${v}". Set SHOP_PASSWORD_RESET_EMAIL_FROM or use default ${SITE_TRANSACTIONAL_EMAIL_FROM}.`,
      );
      continue;
    }
    if (skip === "retired") {
      console.warn(
        `[resend] Ignoring retired domain From "${v}". Update Vercel env to ${SITE_TRANSACTIONAL_EMAIL_FROM}.`,
      );
      continue;
    }
    return { ok: true, from: v };
  }

  return { ok: true, from: SITE_TRANSACTIONAL_EMAIL_FROM };
}

/**
 * From address for shop dashboard + buyer transactional mail (password reset, claims, etc.).
 * Uses SHOP_PASSWORD_RESET_EMAIL_FROM first — same order as working shop emails.
 * Do not prefer CONTACT_QUOTE_FROM_EMAIL here; that var is often stale or contact-form-specific.
 */
export function resolveShopAutomatedTransactionalEmailFrom(): ShopTransactionalFromResult {
  return resolveShopTransactionalEmailFrom([
    process.env.SHOP_PASSWORD_RESET_EMAIL_FROM,
    process.env.SHOP_EMAIL_VERIFICATION_EMAIL_FROM,
    process.env.CONTACT_QUOTE_FROM_EMAIL,
  ]);
}

/** POST to Resend using the configured From address (no domain rewriting). */
export async function postResendTransactionalEmail(params: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  logTag: string;
}): Promise<PostResendTransactionalEmailResult> {
  const res = await postResendEmailApi(params.apiKey, {
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
  const body = await res.text().catch(() => "");

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      body,
      fromUsed: params.from,
    };
  }

  return { ok: true, body, fromUsed: params.from };
}
