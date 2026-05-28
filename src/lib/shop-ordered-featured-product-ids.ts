import type { Prisma } from "@/generated/prisma/client";
import { PLATFORM_ALL_PAGE_FEATURED_LIMIT } from "@/lib/platform-all-page-featured-constants";

export type ParseShopOrderedFeaturedProductIdsOptions = {
  /** Defaults to {@link PLATFORM_ALL_PAGE_FEATURED_LIMIT} (browse-all / shop picks). */
  max?: number;
};

/** Parse ordered platform-shop featured product id JSON (deduped). */
export function parseShopOrderedFeaturedProductIds(
  raw: Prisma.JsonValue | null | undefined,
  options?: ParseShopOrderedFeaturedProductIdsOptions,
): string[] {
  const max = options?.max ?? PLATFORM_ALL_PAGE_FEATURED_LIMIT;
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const id = x.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}
