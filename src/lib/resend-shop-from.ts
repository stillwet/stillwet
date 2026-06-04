import { BRAND_MERCH_NAME, brandMerchEmailFrom } from "@/lib/site-brand";

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

export type PostResendTransactionalEmailResult =
  | { ok: true; body: string; fromUsed: string }
  | { ok: false; status: number; body: string; fromUsed: string };

/**
 * When env uses `noreply@auto.example.com` but only `example.com` is verified in Resend,
 * retry once with the apex domain (`noreply@example.com`).
 */
export function shopFromApexFallback(from: string): string | null {
  const domain = domainFromResendFromHeader(from);
  if (!domain?.startsWith("auto.")) return null;
  const apexDomain = domain.slice("auto.".length);
  if (!apexDomain.includes(".")) return null;
  return from.replace(`@${domain}`, `@${apexDomain}`);
}

export function isResendDomainNotVerifiedResponse(status: number, body: string): boolean {
  if (status !== 403) return false;
  return /domain is not verified/i.test(body);
}

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

/** POST to Resend; on unverified `auto.*` From domain, retry once with the apex domain. */
export async function postResendTransactionalEmail(params: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  logTag: string;
}): Promise<PostResendTransactionalEmailResult> {
  const send = async (from: string) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });
    const body = await res.text().catch(() => "");
    return { res, body, from };
  };

  let attempt = await send(params.from);
  if (
    !attempt.res.ok &&
    isResendDomainNotVerifiedResponse(attempt.res.status, attempt.body)
  ) {
    const fallbackFrom = shopFromApexFallback(params.from);
    if (fallbackFrom && fallbackFrom !== params.from) {
      console.warn(
        `[${params.logTag}] Resend rejected From domain; retrying with apex fallback ${JSON.stringify(fallbackFrom)}`,
      );
      attempt = await send(fallbackFrom);
    }
  }

  if (!attempt.res.ok) {
    return {
      ok: false,
      status: attempt.res.status,
      body: attempt.body,
      fromUsed: attempt.from,
    };
  }

  return { ok: true, body: attempt.body, fromUsed: attempt.from };
}
