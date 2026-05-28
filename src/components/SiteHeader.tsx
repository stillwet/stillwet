import { StoreNav } from "@/components/StoreNav";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";

export async function SiteHeader({ shopSlug }: { shopSlug?: string } = {}) {
  const platform = !shopSlug || shopSlug === PLATFORM_SHOP_SLUG;

  return (
    <StoreNav cartQty={0} shopSlug={platform ? undefined : shopSlug} />
  );
}
