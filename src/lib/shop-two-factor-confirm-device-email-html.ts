import {
  SITE_EMAIL_ACTION_URL_PLACEHOLDER,
  replaceActionUrlInHtmlTemplate,
} from "@/lib/email-template-placeholders";

export const SHOP_TWO_FACTOR_CONFIRM_DEVICE_SUBJECT = "Confirm your shop dashboard sign-in";

/**
 * Full HTML document (same chrome as verify email).
 * `{{ACTION_URL}}` is replaced with the confirm-device link when sending.
 */
export const SHOP_TWO_FACTOR_CONFIRM_DEVICE_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;background:#0a0a0a;color:#e4e4e7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px 20px;">
          <tr><td>
            <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#fafafa;">Confirm your sign-in</p>
            <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#a1a1aa;">
              We noticed a sign-in attempt from a new device. Confirm this sign-in to finish logging in to your shop dashboard.
            </p>
            <p style="margin:0 0 20px;">
              <a href="${SITE_EMAIL_ACTION_URL_PLACEHOLDER}" style="display:inline-block;background:#e4e4e7;color:#18181b;text-decoration:none;font-weight:600;font-size:13px;padding:10px 16px;border-radius:8px;">
                Confirm sign-in
              </a>
            </p>
            <p style="margin:0;font-size:11px;line-height:1.5;color:#71717a;">
              If this wasn’t you, you can ignore this email.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

export function renderShopTwoFactorConfirmDeviceHtml(template: string, confirmUrl: string): string {
  return replaceActionUrlInHtmlTemplate(template, confirmUrl);
}

