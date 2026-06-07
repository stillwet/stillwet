/** Public site brand (display strings only — shop slugs / DB rows are unchanged). */
export const BRAND_NAME = "Still Wet";
/** Uppercase mark in nav, gate, and auth shells (matches legacy styling). */
export const BRAND_LOGO_MARK = "STILL WET";
export const BRAND_MERCH_NAME = "Still Wet Merch";
/** Bright CMY printer inks (logo drops). */
export const BRAND_CMY = {
  cyan: "#00E5FF",
  magenta: "#FF1493",
  yellow: "#FFE500",
} as const;
export const SITE_CONTACT_EMAIL = "info@stillwet.com";
/** Console / server log prefix, e.g. `[stillwet] …` */
export const SITE_LOG_PREFIX = "stillwet";

/**
 * Default Resend From for all automated / transactional email.
 * Verify stillwet.com in Resend; override per-flow with env vars when needed.
 */
export const SITE_TRANSACTIONAL_EMAIL_FROM = `${BRAND_MERCH_NAME} <${SITE_CONTACT_EMAIL}>`;

/** @deprecated Use SITE_TRANSACTIONAL_EMAIL_FROM — kept as alias for callers. */
export function brandMerchEmailFrom(): string {
  return SITE_TRANSACTIONAL_EMAIL_FROM;
}
