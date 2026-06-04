/** Optional in admin HTML; omitted templates still get a logo at send time. */
export const SITE_EMAIL_LOGO_PLACEHOLDER = "{{EMAIL_LOGO}}";

/** PNG for broad email-client support (SVG is often blocked in inbox clients). */
export const SITE_EMAIL_LOGO_PUBLIC_PATH = "/still-wet-logo-2048.png";

/** Marks the injected logo + wordmark header (home-page brand row). */
export const SITE_EMAIL_BRAND_HEADER_MARKER = 'data-stillwet-email-brand="1"';
