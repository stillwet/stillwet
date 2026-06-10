/** Private feature poll page — link-only, not in site nav. */
export const FEATURE_POLL_PATH = "/feature-votes";

export type FeaturePollView = "shop" | "donor" | "auto";

export function parseFeaturePollView(raw: string | undefined): FeaturePollView {
  if (raw === "shop" || raw === "donor") return raw;
  return "auto";
}

export function featurePollShopViewPath(): string {
  return `${FEATURE_POLL_PATH}?view=shop`;
}

export function featurePollDonorViewPath(): string {
  return `${FEATURE_POLL_PATH}?view=donor`;
}

export function featurePollPathWithSupportSession(sessionId: string): string {
  const id = sessionId.trim();
  if (!id) return FEATURE_POLL_PATH;
  return `/api/feature-poll/establish-donor?session_id=${encodeURIComponent(id)}`;
}
