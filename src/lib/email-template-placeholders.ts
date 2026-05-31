/** Placeholder for the signed action URL in HTML shop emails (admin-editable templates). */
export const SITE_EMAIL_ACTION_URL_PLACEHOLDER = "{{ACTION_URL}}";

export function replaceActionUrlInHtmlTemplate(template: string, actionUrl: string): string {
  const escaped = actionUrl
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
  return template.split(SITE_EMAIL_ACTION_URL_PLACEHOLDER).join(escaped);
}

export const GIFT_SETUP_CODE_PLACEHOLDER = "{{SETUP_CODE}}";
export const GIFT_LISTING_CODE_PLACEHOLDER = "{{LISTING_CODE}}";
export const GIFT_LISTING_CREDITS_PLACEHOLDER = "{{LISTING_CREDITS}}";
export const GIFT_PROMOTION_CODE_PLACEHOLDER = "{{PROMOTION_CODE}}";
export const GIFT_PROMOTION_KIND_LABEL_PLACEHOLDER = "{{PROMOTION_KIND_LABEL}}";
export const GIFT_PROMOTION_CREDITS_PLACEHOLDER = "{{PROMOTION_CREDITS}}";
export const GIFT_GOOGLE_SHOPPING_CODE_PLACEHOLDER = "{{GOOGLE_SHOPPING_CODE}}";
export const GIFT_GOOGLE_SHOPPING_CREDITS_PLACEHOLDER = "{{GOOGLE_SHOPPING_CREDITS}}";

export type GiftRedemptionEmailVars = {
  setupCode: string;
  listingCode: string;
  listingCredits: string;
  promotionCode: string;
  promotionKindLabel: string;
  promotionCredits: string;
  googleShoppingCode: string;
  googleShoppingCredits: string;
};

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function replaceGiftCodePlaceholders(
  template: string,
  vars: GiftRedemptionEmailVars,
): string {
  return template
    .split(GIFT_SETUP_CODE_PLACEHOLDER)
    .join(escapeHtmlText(vars.setupCode))
    .split(GIFT_LISTING_CODE_PLACEHOLDER)
    .join(escapeHtmlText(vars.listingCode))
    .split(GIFT_LISTING_CREDITS_PLACEHOLDER)
    .join(escapeHtmlText(vars.listingCredits))
    .split(GIFT_PROMOTION_CODE_PLACEHOLDER)
    .join(escapeHtmlText(vars.promotionCode))
    .split(GIFT_PROMOTION_KIND_LABEL_PLACEHOLDER)
    .join(escapeHtmlText(vars.promotionKindLabel))
    .split(GIFT_PROMOTION_CREDITS_PLACEHOLDER)
    .join(escapeHtmlText(vars.promotionCredits))
    .split(GIFT_GOOGLE_SHOPPING_CODE_PLACEHOLDER)
    .join(escapeHtmlText(vars.googleShoppingCode))
    .split(GIFT_GOOGLE_SHOPPING_CREDITS_PLACEHOLDER)
    .join(escapeHtmlText(vars.googleShoppingCredits));
}

export const CONTACT_QUOTE_NAME_PLACEHOLDER = "{{CONTACT_NAME}}";
export const CONTACT_QUOTE_EMAIL_PLACEHOLDER = "{{CONTACT_EMAIL}}";
export const CONTACT_QUOTE_MESSAGE_PLACEHOLDER = "{{CONTACT_MESSAGE}}";

export function replaceContactQuotePlaceholders(
  template: string,
  vars: { name: string; email: string; message: string },
): string {
  return template
    .split(CONTACT_QUOTE_NAME_PLACEHOLDER)
    .join(vars.name)
    .split(CONTACT_QUOTE_EMAIL_PLACEHOLDER)
    .join(vars.email)
    .split(CONTACT_QUOTE_MESSAGE_PLACEHOLDER)
    .join(vars.message);
}

/** Wraps a fragment so iframe / mail clients show a full document (preview helper). */
export function wrapEmailHtmlFragmentForPreview(fragmentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
<body style="margin:0;padding:24px 16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.55;color:#18181b;background:#f4f4f5;">
${fragmentHtml}
</body>
</html>`;
}
