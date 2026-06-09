import { notFound } from "next/navigation";
import { ProductDetailContent } from "@/components/ProductDetailContent";
import { ProductStorefrontViewBeacon } from "@/components/ProductStorefrontViewBeacon";
import { resolveCachedPublicProductDetail } from "@/lib/storefront-product-detail";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const shop = typeof sp.shop === "string" ? sp.shop : undefined;
  const detail = await resolveCachedPublicProductDetail(slug, shop);
  if (!detail) notFound();
  return (
    <>
      <ProductStorefrontViewBeacon productSlug={detail.product.slug} />
      <ProductDetailContent
        product={detail.product}
        variant="page"
        tenant={detail.tenant}
        adminCatalogSizeExampleImageUrl={detail.adminCatalogSizeExampleImageUrl}
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
