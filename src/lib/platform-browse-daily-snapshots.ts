import { rebuildPlatformBrowseHotItemsSnapshot } from "@/lib/platform-hot-items-snapshot";
import { rebuildPlatformFeaturedShopsSnapshot } from "@/lib/platform-featured-shops-snapshot";
import { rebuildPlatformPopularListingOrderSnapshot } from "@/lib/platform-popular-listing-order-snapshot";
import { rebuildPlatformStoreTagsSnapshot } from "@/lib/platform-store-tags-snapshot";

/**
 * Runs all marketplace daily snapshot rebuilds (Hot items, featured shops, Popular sort order).
 */
export async function rebuildPlatformBrowseDailySnapshots(): Promise<
  | {
      ok: true;
      hotItems: number;
      featuredShops: number;
      popularOrder: number;
      storeTags: number;
    }
  | { ok: false; errors: string[] }
> {
  const hot = await rebuildPlatformBrowseHotItemsSnapshot();
  const shops = await rebuildPlatformFeaturedShopsSnapshot();
  const popular = await rebuildPlatformPopularListingOrderSnapshot();
  const storeTags = await rebuildPlatformStoreTagsSnapshot();

  const errors: string[] = [];
  if (!hot.ok) errors.push(`hotItems: ${hot.error}`);
  if (!shops.ok) errors.push(`featuredShops: ${shops.error}`);
  if (!popular.ok) errors.push(`popularOrder: ${popular.error}`);
  if (!storeTags.ok) errors.push(`storeTags: ${storeTags.error}`);

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    hotItems: hot.ok ? hot.count : 0,
    featuredShops: shops.ok ? shops.count : 0,
    popularOrder: popular.ok ? popular.count : 0,
    storeTags: storeTags.ok ? storeTags.count : 0,
  };
}
