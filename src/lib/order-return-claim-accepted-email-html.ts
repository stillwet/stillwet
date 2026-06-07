import {
  ORDER_RETURN_CLAIM_ORDER_NUMBER_PLACEHOLDER,
  ORDER_RETURN_CLAIM_ID_PLACEHOLDER,
  replaceOrderReturnClaimAcceptedPlaceholders,
  type OrderReturnClaimAcceptedEmailVars,
} from "@/lib/order-return-claim-email-placeholders";
import { BRAND_MERCH_NAME } from "@/lib/site-brand";
import { SITE_EMAIL_LOGO_PLACEHOLDER } from "@/lib/site-email-logo-constants";

export const ORDER_RETURN_CLAIM_ACCEPTED_SUBJECT = `Your ${BRAND_MERCH_NAME} item claim was approved`;

export const ORDER_RETURN_CLAIM_ACCEPTED_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;background:#0a0a0a;color:#e4e4e7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px 20px;">
          <tr><td>
            ${SITE_EMAIL_LOGO_PLACEHOLDER}
            <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#fafafa;">Claim approved</p>
            <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#a1a1aa;">
              Good news — we approved your item claim. A replacement will be shipped to you free of charge.
            </p>
            <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#a1a1aa;">
              <strong style="color:#e4e4e7;">Order:</strong> ${ORDER_RETURN_CLAIM_ORDER_NUMBER_PLACEHOLDER}<br />
              <strong style="color:#e4e4e7;">Reference:</strong> ${ORDER_RETURN_CLAIM_ID_PLACEHOLDER}
            </p>
            <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#a1a1aa;">
              No further action is needed on your part. If you have questions, reply to this email or contact ${BRAND_MERCH_NAME} support.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

export function renderOrderReturnClaimAcceptedHtml(
  template: string,
  vars: OrderReturnClaimAcceptedEmailVars,
): string {
  return replaceOrderReturnClaimAcceptedPlaceholders(template, vars);
}

export function sampleOrderReturnClaimAcceptedEmailVars(): OrderReturnClaimAcceptedEmailVars {
  return {
    orderNumberLabel: "#1234",
    claimId: "clm_preview_abc123",
  };
}
