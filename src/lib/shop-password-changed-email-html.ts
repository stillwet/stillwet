import {
  SITE_EMAIL_ACTION_URL_PLACEHOLDER,
  SITE_EMAIL_CHANGED_AT_UTC_PLACEHOLDER,
  SITE_EMAIL_SECURITY_ALERT_MAILTO_BLOCK_PLACEHOLDER,
  replaceActionUrlInHtmlTemplate,
  replaceChangedAtUtcInHtmlTemplate,
  replaceSecurityAlertMailtoBlockInHtmlTemplate,
} from "@/lib/email-template-placeholders";
import { SITE_EMAIL_LOGO_PLACEHOLDER } from "@/lib/site-email-logo-constants";
import { emailLinkOrigin } from "@/lib/public-app-url";
import { dashQueryParamForTabId } from "@/lib/dashboard-dash-query";

export const SHOP_PASSWORD_CHANGED_EMAIL_SUBJECT = "Your shop dashboard password was changed";

export const SHOP_PASSWORD_CHANGED_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;background:#0a0a0a;color:#e4e4e7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px 20px;">
          <tr><td>
            ${SITE_EMAIL_LOGO_PLACEHOLDER}
            <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#fafafa;">Your dashboard password was changed</p>
            <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#a1a1aa;">
              The password for your shop dashboard account was just changed (${SITE_EMAIL_CHANGED_AT_UTC_PLACEHOLDER}).
            </p>
            <p style="margin:20px 0 12px;font-size:13px;line-height:1.5;color:#a1a1aa;">
              If you did <strong style="color:#e4e4e7;">not</strong> make this change, contact support immediately:
            </p>
            <p style="margin:0 0 12px;">
              <a href="${SITE_EMAIL_ACTION_URL_PLACEHOLDER}" style="display:inline-block;background:#3f3f46;color:#fafafa;text-decoration:none;font-weight:600;font-size:13px;padding:10px 16px;border-radius:8px;">
                Notify support (dashboard)
              </a>
            </p>
            ${SITE_EMAIL_SECURITY_ALERT_MAILTO_BLOCK_PLACEHOLDER}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

export function shopDashboardSupportUrl(origin?: string): string {
  const o = (origin ?? emailLinkOrigin()).replace(/\/$/, "");
  const supportTab = dashQueryParamForTabId("support");
  return `${o}/dashboard?dash=${encodeURIComponent(supportTab)}`;
}

/** Optional mailto line when SHOP_SECURITY_ALERT_EMAIL is set. */
export function buildSecurityAlertMailtoBlockHtml(): string {
  const alertMailbox = process.env.SHOP_SECURITY_ALERT_EMAIL?.trim();
  if (!alertMailbox) {
    return `<p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:#71717a;">
              Sign in and open the <strong style="color:#a1a1aa;">Support</strong> tab if you cannot reach your account.
            </p>`;
  }
  const mailtoHref = `mailto:${encodeURIComponent(alertMailbox)}?subject=${encodeURIComponent(
    "Security: I did not change my shop dashboard account",
  )}&body=${encodeURIComponent(
    "Please investigate unauthorized changes to my shop dashboard account.\n\n",
  )}`;
  return `<p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:#71717a;">
              Or email: <a href="${mailtoHref}" style="color:#93c5fd;text-decoration:underline;">${alertMailbox.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}</a>
            </p>`;
}

export function renderShopPasswordChangedEmailHtml(
  template: string,
  vars: { changedAtUtc: string; supportUrl: string },
): string {
  let html = replaceActionUrlInHtmlTemplate(template, vars.supportUrl);
  html = replaceChangedAtUtcInHtmlTemplate(html, vars.changedAtUtc);
  html = replaceSecurityAlertMailtoBlockInHtmlTemplate(html, buildSecurityAlertMailtoBlockHtml());
  return html;
}
