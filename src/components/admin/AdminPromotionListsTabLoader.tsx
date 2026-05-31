import { AdminBrowseShopsPageFeaturedPanel } from "@/components/admin/AdminBrowseShopsPageFeaturedPanel";
import { AdminHomeHotCarouselFeaturedPanel } from "@/components/admin/AdminHomeHotCarouselFeaturedPanel";
import { AdminPopularItemsFeaturedPanel } from "@/components/admin/AdminPopularItemsFeaturedPanel";
import { loadAdminPromotionListsInitial } from "@/lib/admin-promotion-lists-load";

export async function AdminPromotionListsTabLoader() {
  const data = await loadAdminPromotionListsInitial();

  return (
    <>
      <AdminHomeHotCarouselFeaturedPanel
        key={`home-hot:${JSON.stringify(data.platformHomeHotCarouselInitialIds)}`}
        labelsByProductId={data.homeHotLabelsByProductId}
        initialProductIds={data.platformHomeHotCarouselInitialIds}
      />
      <AdminPopularItemsFeaturedPanel
        key={`popular-items:${JSON.stringify(data.permanentPopularProductIds)}:${JSON.stringify(data.activePopularProductIds)}`}
        activeProductIds={data.activePopularProductIds}
        permanentProductIds={data.permanentPopularProductIds}
        labelsByProductId={data.popularLabelsByProductId}
      />
      <AdminBrowseShopsPageFeaturedPanel
        key={`browse-shops:${JSON.stringify(data.permanentFeaturedShopIds)}:${JSON.stringify(data.activeFeaturedShopIds)}`}
        activeShopIds={data.activeFeaturedShopIds}
        permanentShopIds={data.permanentFeaturedShopIds}
        permanentShopOptions={data.permanentFeaturedShopOptions}
        activeShopLabelsById={data.activeFeaturedShopLabelsById}
      />
    </>
  );
}
