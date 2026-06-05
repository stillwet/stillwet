import { config } from "dotenv";
import { siteEmailLogoOutboundUrl } from "../src/lib/site-email-logo-url";
import { applySiteEmailLogoToHtml } from "../src/lib/site-email-logo-html";
import { SHOP_PASSWORD_CHANGED_HTML_TEMPLATE } from "../src/lib/shop-password-changed-email-html";

config({ path: ".env" });
config({ path: ".env.local", override: true });

const url = siteEmailLogoOutboundUrl();
console.log("[email-logo] SITE_EMAIL_LOGO_URL override:", process.env.SITE_EMAIL_LOGO_URL ? "set" : "(not set)");
console.log("[email-logo] R2_PUBLIC_BASE_URL:", process.env.R2_PUBLIC_BASE_URL ?? "(not set)");
console.log("[email-logo] resolved outbound URL:", url);

const html = applySiteEmailLogoToHtml(SHOP_PASSWORD_CHANGED_HTML_TEMPLATE);
const m = html.match(/<img[^>]+src="([^"]+)"/);
console.log("[email-logo] img src in sample email:", m?.[1] ?? "NOT FOUND");

if (url.includes("stillwet.com") || url.includes("xtinadom.com")) {
  console.warn("[email-logo] WARN: URL uses app domain (may be gated by SITE_ACCESS_PASSWORD)");
}
if (!url.includes("r2.dev") && !url.startsWith("data:")) {
  console.warn("[email-logo] WARN: URL is not R2 public CDN");
}
