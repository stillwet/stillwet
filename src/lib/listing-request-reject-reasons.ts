/** Submitted as `rejectReason` on admin reject listing form; validated server-side. */
export const LISTING_REJECT_REASON_VALUES = ["regulations", "artwork", "other"] as const;

export type ListingRejectReasonValue = (typeof LISTING_REJECT_REASON_VALUES)[number];

export function parseListingRejectReason(raw: unknown): ListingRejectReasonValue | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return (LISTING_REJECT_REASON_VALUES as readonly string[]).includes(s)
    ? (s as ListingRejectReasonValue)
    : null;
}

/** Custom listing image reject: no print-ready / artwork option (only regulations + other). */
export const LISTING_SUPPLEMENT_REJECT_REASON_VALUES = ["regulations", "other"] as const;

export type ListingSupplementRejectReasonValue = (typeof LISTING_SUPPLEMENT_REJECT_REASON_VALUES)[number];

export function parseListingSupplementRejectReason(raw: unknown): ListingSupplementRejectReasonValue | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return (LISTING_SUPPLEMENT_REJECT_REASON_VALUES as readonly string[]).includes(s)
    ? (s as ListingSupplementRejectReasonValue)
    : null;
}

export function listingRejectionNoticeDetail(
  reason: ListingRejectReasonValue,
  regulationsUrl: string | null,
): string {
  switch (reason) {
    case "regulations":
      return regulationsUrl
        ? `Reason: Goes against item regulations — ${regulationsUrl}`
        : "Reason: Goes against item regulations. Review the shop regulations on the site before resubmitting.";
    case "artwork":
      return "Reason: Artwork or file does not meet print-ready requirements (resolution, format, or content guidelines).";
    case "other":
      return "Reason: Other — contact support if you need more detail.";
    default:
      return "";
  }
}
