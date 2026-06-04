import {
  SITE_EMAIL_ACTION_URL_PLACEHOLDER,
  replaceActionUrlInHtmlTemplate,
} from "@/lib/email-template-placeholders";
import { SITE_EMAIL_LOGO_PLACEHOLDER } from "@/lib/site-email-logo-html";

export const SHOP_INACTIVITY_WARNING_EMAIL_SUBJECT = "Warning: your shop may be deactivated";

export const SHOP_INACTIVITY_WARNING_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;background:#0a0a0a;color:#e4e4e7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:540px;background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px 20px;">
          <tr><td>
            ${SITE_EMAIL_LOGO_PLACEHOLDER}
            <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#fafafa;">Shop inactivity warning</p>
            <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#a1a1aa;">
              We have not seen a creator dashboard login for this shop in at least 60 days. If you do not log in within the next 30 days, your shop account will be deactivated.
            </p>
            <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#a1a1aa;">
              Deactivated shops can stay available to buyers, but sales proceeds while deactivated go 100% to the platform. Reactivating later requires a one-time $5 fee.
            </p>
            <p style="margin:0 0 20px;">
              <a href="${SITE_EMAIL_ACTION_URL_PLACEHOLDER}" style="display:inline-block;background:#e4e4e7;color:#18181b;text-decoration:none;font-weight:600;font-size:13px;padding:10px 16px;border-radius:8px;">
                Log in to keep your shop active
              </a>
            </p>
            <p style="margin:0;font-size:11px;line-height:1.5;color:#71717a;">
              Logging in to the shop dashboard resets the inactivity timer.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

export function renderShopInactivityWarningHtml(template: string, loginUrl: string): string {
  return replaceActionUrlInHtmlTemplate(template, loginUrl);
}
