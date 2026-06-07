import { notFound } from "next/navigation";
import { ProductDetailContent } from "@/components/ProductDetailContent";
import { ProductModalShell } from "@/components/ProductModalShell";
import { resolveCachedPublicProductDetail } from "@/lib/storefront-product-detail";
import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { resolveShopStorefrontPreviewContext } from "@/lib/shop-storefront-owner-preview";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Shared body for modal intercept routes (`ProductModalShell` + tenant-aware resolution). */
export async function ProductModalInterceptBody({
  productSlug,
  shopSlug,
}: {
  productSlug: string;
  shopSlug?: string;
}) {
  const normalizedShop = shopSlug?.trim() ?? "";
  const shop =
    normalizedShop && normalizedShop !== PLATFORM_SHOP_SLUG
      ? await prisma.shop.findFirst({
          where: { slug: normalizedShop, active: true },
          select: {
            slug: true,
            stripeConnectAccountId: true,
            connectChargesEnabled: true,
          },
        })
      : null;

  const previewContext = shop
    ? await resolveShopStorefrontPreviewContext(normalizedShop, shop)
    : { isOwnerPreview: false, connectReadyForBuyerSales: true, showConnectNotLiveBanner: false };

  const detail = await resolveCachedPublicProductDetail(productSlug, shopSlug, {
    ownerPreview: previewContext.isOwnerPreview,
  });
  if (!detail) notFound();

  const purchaseDisabled =
    !previewContext.connectReadyForBuyerSales && previewContext.isOwnerPreview;

  return (
    <ProductModalShell>
      <ProductDetailContent
        product={detail.product}
        variant="modal"
        tenant={detail.tenant}
        adminListingSecondaryImageUrl={detail.adminListingSecondaryImageUrl}
        ownerSupplementImageUrl={detail.ownerSupplementImageUrl}
        listingStorefrontCatalogImageUrls={detail.listingStorefrontCatalogImageUrls}
        adminCatalogStorefrontDescription={detail.adminCatalogStorefrontDescription}
        listingItemName={detail.listingItemName}
        adminCatalogItemName={detail.adminCatalogItemName}
        storefrontItemBlurb={detail.storefrontItemBlurb}
        listingSearchKeywords={detail.listingSearchKeywords}
        purchaseDisabled={purchaseDisabled}
      />
    </ProductModalShell>
  );
}

/** Shared by `(store)/@modal/(.)product` and `(site-nav)/@modal/(...)product` intercept routes. */
export default async function ProductModalInterceptPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const shop = typeof sp.shop === "string" ? sp.shop : undefined;
  return <ProductModalInterceptBody productSlug={slug} shopSlug={shop} />;
}
