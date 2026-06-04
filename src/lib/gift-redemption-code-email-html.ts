import {
  GIFT_SETUP_CODE_PLACEHOLDER,
  replaceGiftCodePlaceholders,
  type GiftRedemptionEmailVars,
} from "@/lib/email-template-placeholders";

import { BRAND_MERCH_NAME } from "@/lib/site-brand";
import { SITE_EMAIL_LOGO_PLACEHOLDER } from "@/lib/site-email-logo-constants";

export const GIFT_REDEMPTION_CODE_EMAIL_SUBJECT = `Your ${BRAND_MERCH_NAME} shop setup gift code`;

export const GIFT_REDEMPTION_CODE_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;background:#0a0a0a;color:#e4e4e7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px 20px;">
          <tr><td>
            ${SITE_EMAIL_LOGO_PLACEHOLDER}
            <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#fafafa;">Shop setup gift code</p>
            <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#a1a1aa;">
              Thanks for gifting a creator on ${BRAND_MERCH_NAME}. Send this one-time code to the creator off-platform.
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;">
              <tr>
                <td style="padding:10px 0;border-top:1px solid #27272a;border-bottom:1px solid #27272a;">
                  <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#71717a;">Shop setup fee</p>
                  <p style="margin:0;font-size:18px;letter-spacing:0.12em;font-weight:700;color:#fafafa;">${GIFT_SETUP_CODE_PLACEHOLDER}</p>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#a1a1aa;">
              The creator redeems this code on the Create Shop page when they sign up for an account.
            </p>
            <p style="margin:0;font-size:11px;line-height:1.5;color:#71717a;">
              This code can be used once. ${BRAND_MERCH_NAME} does not send it directly to the creator.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

export function renderGiftRedemptionCodeEmailHtml(
  template: string,
  vars: GiftRedemptionEmailVars,
): string {
  return replaceGiftCodePlaceholders(template, vars);
}

export function defaultGiftRedemptionEmailVars(
  partial: Partial<GiftRedemptionEmailVars> = {},
): GiftRedemptionEmailVars {
  return {
    setupCode: "Not included",
    ...partial,
  };
}
