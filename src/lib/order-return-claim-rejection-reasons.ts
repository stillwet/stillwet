import { OrderReturnClaimRejectionReason } from "@/generated/prisma/enums";

export const ORDER_RETURN_CLAIM_REJECTION_REASON_OPTIONS = [
  {
    value: OrderReturnClaimRejectionReason.past_claim_window,
    label: "Past claim window",
  },
  {
    value: OrderReturnClaimRejectionReason.does_not_meet_policy,
    label: "Item does not meet defect/misprint policy",
  },
] as const;

export function orderReturnClaimRejectionReasonLabel(
  reason: OrderReturnClaimRejectionReason,
): string {
  const row = ORDER_RETURN_CLAIM_REJECTION_REASON_OPTIONS.find((o) => o.value === reason);
  return row?.label ?? reason;
}

export function parseOrderReturnClaimRejectionReason(
  raw: string | null | undefined,
): OrderReturnClaimRejectionReason | null {
  const s = String(raw ?? "").trim();
  if (s === OrderReturnClaimRejectionReason.past_claim_window) {
    return OrderReturnClaimRejectionReason.past_claim_window;
  }
  if (s === OrderReturnClaimRejectionReason.does_not_meet_policy) {
    return OrderReturnClaimRejectionReason.does_not_meet_policy;
  }
  return null;
}
