import { emailLinkOrigin } from "@/lib/public-app-url";
import { readR2Env } from "@/lib/r2-upload";
import { SITE_EMAIL_LOGO_PUBLIC_PATH } from "@/lib/site-email-logo-constants";

/** Stable R2 object key for the PNG used in transactional email headers. */
export const SITE_EMAIL_LOGO_R2_OBJECT_KEY = "site/still-wet-logo-2048.png";

/** Public HTTPS URL when the logo is on R2 (`R2_PUBLIC_BASE_URL` + key). */
export function siteEmailLogoR2PublicUrl(): string | undefined {
  const base = readR2Env("R2_PUBLIC_BASE_URL")?.replace(/\/$/, "");
  if (!base) return undefined;
  return `${base}/${SITE_EMAIL_LOGO_R2_OBJECT_KEY}`;
}

/**
 * Logo `src` for outbound email (Resend). Prefers R2/CDN so images load even when the
 * storefront is behind SITE_ACCESS_PASSWORD. Override with `SITE_EMAIL_LOGO_URL`.
 */
export function siteEmailLogoOutboundUrl(origin?: string): string {
  const override = process.env.SITE_EMAIL_LOGO_URL?.trim();
  if (override) return override;

  const r2 = siteEmailLogoR2PublicUrl();
  if (r2) return r2;

  const base = (origin ?? emailLinkOrigin()).replace(/\/$/, "");
  return `${base}${SITE_EMAIL_LOGO_PUBLIC_PATH}`;
}
