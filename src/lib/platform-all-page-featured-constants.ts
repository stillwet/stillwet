/** Max featured carousel slots on `/shop/all` (“Hot items”). */
export const PLATFORM_ALL_PAGE_FEATURED_LIMIT = 10;

/** Paid order lines counted toward “top selling” backfill on `/shop/all`. */
export const PLATFORM_ALL_PAGE_FEATURED_SALES_WINDOW_DAYS = 60;

/**
 * Marketing home “Hot items”: default count when no manual list is saved (promotions first, then
 * view-count backfill).
 */
export const HOME_HOT_CAROUSEL_DEFAULT_DISPLAY = PLATFORM_ALL_PAGE_FEATURED_LIMIT;

/** Max items in the saved admin ordering JSON for the marketing home carousel. */
export const HOME_HOT_CAROUSEL_MAX_ITEMS = 100;

/**
 * @deprecated Use {@link HOME_HOT_CAROUSEL_DEFAULT_DISPLAY} or {@link HOME_HOT_CAROUSEL_MAX_ITEMS}.
 * Previously coupled home carousel display cap to `/shop/all` featured limit.
 */
export const HOME_HOT_CAROUSEL_LIMIT = PLATFORM_ALL_PAGE_FEATURED_LIMIT;

/** Featured shops strip on `/shops` when no manual ordering is saved (matches ranking helper). */
export const SHOPS_BROWSE_PAGE_FEATURED_DEFAULT_DISPLAY = 8;

/** Max creator shop ids in saved JSON for `/shops` featured strip override. */
export const SHOPS_BROWSE_PAGE_FEATURED_MAX_ITEMS = 100;
