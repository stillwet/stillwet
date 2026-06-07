export const ORDER_RETURN_CLAIM_ORDER_NUMBER_PLACEHOLDER = "{{ORDER_NUMBER}}";
export const ORDER_RETURN_CLAIM_ID_PLACEHOLDER = "{{CLAIM_ID}}";
export const ORDER_RETURN_CLAIM_REJECTION_REASON_PLACEHOLDER = "{{REJECTION_REASON}}";
export const ORDER_RETURN_CLAIM_RETURNS_POLICY_URL_PLACEHOLDER = "{{RETURNS_POLICY_URL}}";

export type OrderReturnClaimEmailVars = {
  orderNumberLabel: string;
  claimId: string;
};

export type OrderReturnClaimRejectedEmailVars = OrderReturnClaimEmailVars & {
  rejectionReasonLabel: string;
  returnsPolicyUrl: string;
};

export type OrderReturnClaimAcceptedEmailVars = OrderReturnClaimEmailVars;

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value);
}

export function replaceOrderReturnClaimPlaceholders(
  template: string,
  vars: OrderReturnClaimEmailVars,
): string {
  return template
    .split(ORDER_RETURN_CLAIM_ORDER_NUMBER_PLACEHOLDER)
    .join(escapeHtmlText(vars.orderNumberLabel))
    .split(ORDER_RETURN_CLAIM_ID_PLACEHOLDER)
    .join(escapeHtmlText(vars.claimId));
}

export function replaceOrderReturnClaimRejectedPlaceholders(
  template: string,
  vars: OrderReturnClaimRejectedEmailVars,
): string {
  return replaceOrderReturnClaimPlaceholders(template, vars)
    .split(ORDER_RETURN_CLAIM_REJECTION_REASON_PLACEHOLDER)
    .join(escapeHtmlText(vars.rejectionReasonLabel))
    .split(ORDER_RETURN_CLAIM_RETURNS_POLICY_URL_PLACEHOLDER)
    .join(escapeHtmlAttribute(vars.returnsPolicyUrl));
}

export function replaceOrderReturnClaimAcceptedPlaceholders(
  template: string,
  vars: OrderReturnClaimAcceptedEmailVars,
): string {
  return replaceOrderReturnClaimPlaceholders(template, vars);
}
