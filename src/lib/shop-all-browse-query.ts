import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";

export type ShopAllBrowseSortParam = "price" | "popular" | "new";

export const SHOP_ALL_PAGE_SIZE = 20;

/** Carousel filler pool — {@link productsToFeaturedCarouselItems} keeps 12; small scan avoids loading every listing. */
export const SHOP_ALL_FEATURED_POOL_LIMIT = 48;

export function shopAllBrowsePath(shopSlug: string): string {
  return shopSlug === PLATFORM_SHOP_SLUG
    ? "/shop/all"
    : `/s/${encodeURIComponent(shopSlug)}/all`;
}

/**
 * Query string for `/shop/all` and `/s/{shop}/all` — keep in sync with form hidden fields and sort links.
 */
export function shopAllBrowseQueryString(opts: {
  q?: string | null;
  tag?: string | null;
  flat?: boolean;
  sort?: ShopAllBrowseSortParam | null;
  /** Omit or 1: no `page` param (first page). */
  page?: number;
}) {
  const p = new URLSearchParams();
  if (opts.q?.trim()) p.set("q", opts.q.trim());
  if (opts.tag?.trim()) p.set("tag", opts.tag.trim());
  if (opts.flat) p.set("flat", "1");
  if (opts.sort && opts.sort !== "price") p.set("sort", opts.sort);
  if (opts.page != null && opts.page > 1) p.set("page", String(opts.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function parseShopAllPageParam(
  raw: string | string[] | undefined,
): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(s ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), 1_000_000);
}
