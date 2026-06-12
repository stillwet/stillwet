/** Canonical slug for the legacy / single-catalog shop (migration seed). */
export const PLATFORM_SHOP_SLUG = "platform" as const;

/** Official Still Wet creator shop — hot-items carousel fallback on `/shop/all`. */
export const STILLWET_SHOP_SLUG = "stillwet" as const;

/**
 * Founder’s creator shop — unlimited free publication slots (same fee logic as infinitely many free ordinals).
 */
export const FOUNDER_UNLIMITED_FREE_LISTINGS_SHOP_SLUG = "goddess-xtina" as const;

/**
 * Backfill order for `/shop/all` “Hot items” when promotions + sales/views tiers don’t fill 10 slots.
 * Override in prod via `PLATFORM_HOT_ITEMS_FALLBACK_SHOP_SLUGS` (comma-separated slugs).
 */
export function platformHotItemsFallbackShopSlugs(): readonly string[] {
  const raw = process.env.PLATFORM_HOT_ITEMS_FALLBACK_SHOP_SLUGS?.trim();
  if (raw) {
    return raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  }
  return ["stillwet", "stillwet-merch"];
}

/**
 * Shops always shown on the `/shops` featured carousel when pins apply. When a pin is not already in
 * the top five by ranking, it occupies positions 4 and 5 (1-based). Order within the pair follows
 * this list (default platform shop slugs unless overridden in env).
 */
export function platformFeaturedShopPinSlugs(): readonly string[] {
  return platformHotItemsFallbackShopSlugs();
}

export function isFounderUnlimitedFreeListingsShop(shopSlug: string): boolean {
  return shopSlug === FOUNDER_UNLIMITED_FREE_LISTINGS_SHOP_SLUG;
}

/** First N listings per shop have no publication fee (ordered by creation time). */
export const LISTING_FEE_FREE_SLOT_COUNT = 3;

/**
 * Creator dashboard copy only (“First 3 listings are free”, purchase-listing hint, etc.).
 * Always **3** in UI — not fee caps, bonus slots, or {@link LISTING_FEE_FREE_SLOT_COUNT}.
 * Change only when the product owner explicitly requests it.
 */
export const CREATOR_FREE_LISTINGS_MESSAGE_COUNT = 3 as const;

/**
 * Shop listing ids that were published at no fee outside the normal first-N free slots
 * (comps, one-off promos). Admin Shop Data shows these with ":)" instead of "--".
 * Founder unlimited-free shop does not need ids listed here.
 */
export const SPECIAL_PROMOTION_FREE_LISTING_IDS = new Set<string>([]);

/**
 * Listing publication fee (USD cents) for each listing after the free slots.
 * First {@link LISTING_FEE_FREE_SLOT_COUNT} listings are free.
 */
export const LISTING_FEE_CENTS = 25;

/**
 * Maximum shop-owner list price (USD cents) for listing requests and dashboard price edits.
 * Enforced on submit / save; admin tooling is not limited by this constant.
 */
export const SHOP_LISTING_MAX_PRICE_CENTS = 50_000;

/** e.g. "$500.00" for UI copy tied to {@link SHOP_LISTING_MAX_PRICE_CENTS}. */
export function shopListingMaxPriceUsdLabel(): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(SHOP_LISTING_MAX_PRICE_CENTS / 100);
}

export type FreeListingRequestSlotsSummary = {
  cap: number;
  remaining: number;
  /** Purchased, admin-granted, or coupon listing slots not yet consumed (excludes the default first 3). */
  listingCreditsAvailable: number;
  founderUnlimited: boolean;
};

/** Request listing form is blocked until the shop buys credits (paid slot needed, balance empty). */
export function listingRequestBlockedForNoCredits(
  needsCredit: boolean,
  slots: FreeListingRequestSlotsSummary,
): boolean {
  if (!needsCredit || slots.founderUnlimited) return false;
  return slots.listingCreditsAvailable <= 0;
}

/** Whether the next submitted listing request would require a listing credit (beyond free 3 + bonus pool). */
export function nextListingRequestRequiresCredit(
  shopSlug: string,
  bonusFreeSlots: number,
  submittedRequestCount: number,
): boolean {
  const nextOrdinal = Math.max(0, submittedRequestCount) + 1;
  return listingFeeCentsForOrdinal(nextOrdinal, shopSlug, bonusFreeSlots) > 0;
}

/** Bonus / purchased / coupon listing credits still available (not counting the default first 3). */
export function shopListingCreditsAvailable(
  bonusFreeSlots: number,
  nonDraftListingCount: number,
): number {
  const bonus = Math.max(0, Math.floor(bonusFreeSlots));
  const used = Math.max(0, nonDraftListingCount);
  const bonusUsed = Math.max(0, used - LISTING_FEE_FREE_SLOT_COUNT);
  return Math.max(0, bonus - bonusUsed);
}

/** Free publication slots for new listing requests (non-draft rows count toward the cap). */
export function freeListingRequestSlotsSummary(
  shopSlug: string,
  bonusFreeSlots: number,
  nonDraftListingCount: number,
): FreeListingRequestSlotsSummary {
  if (isFounderUnlimitedFreeListingsShop(shopSlug)) {
    return {
      cap: LISTING_FEE_FREE_SLOT_COUNT,
      remaining: Number.POSITIVE_INFINITY,
      listingCreditsAvailable: Number.POSITIVE_INFINITY,
      founderUnlimited: true,
    };
  }
  const cap = listingFeeFreeSlotCap(shopSlug, bonusFreeSlots);
  const used = Math.max(0, nonDraftListingCount);
  return {
    cap,
    remaining: Math.max(0, cap - used),
    listingCreditsAvailable: shopListingCreditsAvailable(bonusFreeSlots, used),
    founderUnlimited: false,
  };
}

/** Total fee-free listing ordinals for a non-founder shop (base free count + promo bonus). */
export function listingFeeFreeSlotCap(shopSlug: string, bonusFreeSlots: number): number {
  if (isFounderUnlimitedFreeListingsShop(shopSlug)) {
    return LISTING_FEE_FREE_SLOT_COUNT;
  }
  return LISTING_FEE_FREE_SLOT_COUNT + Math.max(0, Math.floor(bonusFreeSlots));
}

/** Fee in cents for the Nth listing in a shop (1 = oldest), after free slots. */
export function listingFeeCentsForOrdinal(
  ordinal1Based: number,
  shopSlug?: string,
  bonusFreeSlots = 0,
): number {
  if (shopSlug && isFounderUnlimitedFreeListingsShop(shopSlug)) {
    return 0;
  }
  if (ordinal1Based <= 0) return LISTING_FEE_CENTS;
  const cap = LISTING_FEE_FREE_SLOT_COUNT + Math.max(0, Math.floor(bonusFreeSlots));
  return ordinal1Based <= cap ? 0 : LISTING_FEE_CENTS;
}

/** Listing id prefix used in SQL migration (`sl_` || productId). */
export const LISTING_ID_PREFIX = "sl_" as const;

export function listingIdForProductId(productId: string): string {
  return `${LISTING_ID_PREFIX}${productId}`;
}

export function productHref(shopSlug: string, productSlug: string): string {
  if (shopSlug === PLATFORM_SHOP_SLUG) {
    return `/product/${productSlug}`;
  }
  return `/s/${shopSlug}/product/${productSlug}`;
}

export function shopCartHref(shopSlug: string): string {
  if (shopSlug === PLATFORM_SHOP_SLUG) return "/cart";
  return `/s/${shopSlug}/cart`;
}

export function shopCheckoutHref(shopSlug: string): string {
  if (shopSlug === PLATFORM_SHOP_SLUG) return "/checkout";
  return `/s/${shopSlug}/checkout`;
}

export function shopAllProductsHref(shopSlug: string): string {
  if (shopSlug === PLATFORM_SHOP_SLUG) return "/shop/all";
  return `/s/${shopSlug}/all`;
}

export function shopUniversalTagHref(shopSlug: string, tagSlug: string): string {
  if (shopSlug === PLATFORM_SHOP_SLUG) return `/shop/tag/${tagSlug}`;
  return `/s/${shopSlug}/tag/${tagSlug}`;
}
