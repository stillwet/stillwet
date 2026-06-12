import { StoreNav } from "@/components/StoreNav";
import { SiteBetaBanner } from "@/components/SiteBetaBanner";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";

export async function SiteHeader({ shopSlug }: { shopSlug?: string } = {}) {
  const platform = !shopSlug || shopSlug === PLATFORM_SHOP_SLUG;

  return (
    <div className="sticky top-0 z-[1000]">
      <StoreNav cartQty={0} shopSlug={platform ? undefined : shopSlug} />
      <SiteBetaBanner />
    </div>
  );
}
