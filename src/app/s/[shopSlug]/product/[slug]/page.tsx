import { notFound } from "next/navigation";
import { ProductDetailContent } from "@/components/ProductDetailContent";
import { ProductStorefrontViewBeacon } from "@/components/ProductStorefrontViewBeacon";
import { resolveCachedPublicProductDetail } from "@/lib/storefront-product-detail";

type Props = { params: Promise<{ shopSlug: string; slug: string }> };

export default async function ShopTenantProductPage({ params }: Props) {
  const { shopSlug, slug } = await params;
  const detail = await resolveCachedPublicProductDetail(slug, shopSlug);
  if (!detail) notFound();
  return (
    <>
      <ProductStorefrontViewBeacon productSlug={detail.product.slug} />
      <ProductDetailContent
        product={detail.product}
        variant="page"
        tenant={detail.tenant}
        printifyVariantShopPriceCentsById={detail.printifyVariantShopPriceCentsById}
        adminListingSecondaryImageUrl={detail.adminListingSecondaryImageUrl}
        ownerSupplementImageUrl={detail.ownerSupplementImageUrl}
        listingStorefrontCatalogImageUrls={detail.listingStorefrontCatalogImageUrls}
        adminCatalogStorefrontDescription={detail.adminCatalogStorefrontDescription}
        listingItemName={detail.listingItemName}
        adminCatalogItemName={detail.adminCatalogItemName}
        storefrontItemBlurb={detail.storefrontItemBlurb}
        listingSearchKeywords={detail.listingSearchKeywords}
      />
    </>
  );
}
