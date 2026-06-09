import { notFound } from "next/navigation";
import { ProductDetailContent } from "@/components/ProductDetailContent";
import { ProductStorefrontViewBeacon } from "@/components/ProductStorefrontViewBeacon";
import { resolveCachedPublicProductDetail } from "@/lib/storefront-product-detail";
import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { resolveShopStorefrontPreviewContext } from "@/lib/shop-storefront-owner-preview";

type Props = { params: Promise<{ shopSlug: string; slug: string }> };

export default async function ShopTenantProductPage({ params }: Props) {
  const { shopSlug, slug } = await params;

  const shop =
    shopSlug === PLATFORM_SHOP_SLUG
      ? null
      : await prisma.shop.findFirst({
          where: { slug: shopSlug, active: true },
          select: {
            slug: true,
            stripeConnectAccountId: true,
            connectChargesEnabled: true,
          },
        });

  const previewContext = shop
    ? await resolveShopStorefrontPreviewContext(shopSlug, shop)
    : { isOwnerPreview: false, connectReadyForBuyerSales: true, showConnectNotLiveBanner: false };

  const detail = await resolveCachedPublicProductDetail(slug, shopSlug, {
    ownerPreview: previewContext.isOwnerPreview,
  });
  if (!detail) notFound();

  const purchaseDisabled =
    !previewContext.connectReadyForBuyerSales && previewContext.isOwnerPreview;

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
        purchaseDisabled={purchaseDisabled}
      />
    </>
  );
}
