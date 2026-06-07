import Link from "next/link";
import { ProductAddToCartForm } from "@/components/ProductAddToCartForm";
import { productImageUrlsForShopListing } from "@/lib/product-media";
import { ProductImageGallery } from "@/components/ProductImageGallery";
import { PRODUCT_HERO_GALLERY_WRAP_CLASS } from "@/lib/product-image-gallery-constants";
import { StoreDocumentPanel } from "@/components/StoreDocumentPanel";
import { SHOP_ALL_ROUTE } from "@/lib/constants";
import type { StorefrontProduct } from "@/lib/product-storefront";
import { PLATFORM_SHOP_SLUG, shopAllProductsHref, shopUniversalTagHref } from "@/lib/marketplace-constants";
import {
  firstLinkedAdminCatalogItemName,
  storefrontListingDisplayTitle,
} from "@/lib/storefront-listing-display-name";

const SHOP_NAME_LINK_CLASS =
  "store-dimension-brand text-sm uppercase tracking-[0.2em] text-blue-400/80 transition hover:text-blue-300/90 sm:text-base";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function ProductDetailContent({
  product,
  variant,
  tenant,
  adminListingSecondaryImageUrl,
  ownerSupplementImageUrl,
  listingStorefrontCatalogImageUrls,
  adminCatalogStorefrontDescription,
  /** Shop listing’s item name (`requestItemName`); preferred for title with admin catalog fallback. */
  listingItemName,
  /** Admin List item `name` (resolved server-side); used in title and subtitle when distinct from listing name. */
  adminCatalogItemName,
  /** Shop owner one-line pitch (`ShopListing.storefrontItemBlurb`, max tweet length). */
  storefrontItemBlurb,
  /** Optional search hints (`ShopListing.listingSearchKeywords`). */
  listingSearchKeywords,
  purchaseDisabled = false,
}: {
  product: StorefrontProduct;
  variant: "page" | "modal";
  /** When set, cart + breadcrumbs target this shop slug (`/s/...`). */
  tenant?: { shopSlug: string; listingPriceCents: number; shopDisplayName: string };
  /** Optional admin-set listing image (tenant PDP only). */
  adminListingSecondaryImageUrl?: string | null;
  /** Extra listing image from the shop owner (tenant PDP only). */
  ownerSupplementImageUrl?: string | null;
  /** Catalog image subset for this shop listing; undefined = all catalog images. */
  listingStorefrontCatalogImageUrls?: string[];
  /**
   * Admin List “Storefront description” from server resolution only — never `Product.description`
   * or merged catalog rows.
   */
  adminCatalogStorefrontDescription?: string;
  listingItemName?: string | null;
  adminCatalogItemName?: string | null;
  storefrontItemBlurb?: string | null;
  listingSearchKeywords?: string | null;
  purchaseDisabled?: boolean;
}) {
  const shopSlug = tenant?.shopSlug ?? PLATFORM_SHOP_SLUG;
  const displayItemName = storefrontListingDisplayTitle({
    requestItemName: listingItemName,
    adminCatalogItemName,
    product,
  });
  const resolvedAdminCatalogItemName =
    adminCatalogItemName?.trim() || firstLinkedAdminCatalogItemName(product);
  const showAdminCatalogSubtitle =
    resolvedAdminCatalogItemName != null &&
    resolvedAdminCatalogItemName.toLowerCase() !== displayItemName.trim().toLowerCase();
  const adminCatalogSubtitle = showAdminCatalogSubtitle ? (
    <p className="mt-1 text-[11px] font-normal leading-snug text-zinc-500 sm:text-xs">
      {resolvedAdminCatalogItemName}
    </p>
  ) : null;
  const displayPriceCents = tenant?.listingPriceCents ?? product.priceCents;

  const images = productImageUrlsForShopListing(product, {
    adminListingSecondaryImageUrl,
    ownerSupplementImageUrl,
    listingStorefrontCatalogImageUrls,
  });
  const description = (adminCatalogStorefrontDescription ?? "").trim();
  const blurbText = storefrontItemBlurb?.trim() || "";
  const keywordsText = listingSearchKeywords?.trim() || "";

  const primary = product.primaryTag;
  const allProductsHref =
    shopSlug === PLATFORM_SHOP_SLUG ? SHOP_ALL_ROUTE : shopAllProductsHref(shopSlug);
  const breadcrumb = primary ? (
    <p className="store-kicker mb-8 text-zinc-500">
      <Link
        href={shopUniversalTagHref(shopSlug, primary.slug)}
        className="hover:text-blue-400/90"
      >
        {primary.name}
      </Link>
    </p>
  ) : null;

  const grid = (
    <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-x-8 xl:gap-x-10">
      <div className={PRODUCT_HERO_GALLERY_WRAP_CLASS}>
        <ProductImageGallery images={images} />
        {purchaseDisabled ? null : (
          <ProductAddToCartForm
            productId={product.id}
            shopSlug={shopSlug === PLATFORM_SHOP_SLUG ? undefined : shopSlug}
          />
        )}
      </div>
      <div
        className={
          variant === "modal"
            ? `${PRODUCT_HERO_GALLERY_WRAP_CLASS} aspect-square overflow-y-auto overscroll-contain rounded-xl bg-zinc-950/92 p-4 sm:p-5`
            : undefined
        }
      >
        {tenant ? (
          <p className="m-0">
            <Link
              href={
                shopSlug === PLATFORM_SHOP_SLUG
                  ? allProductsHref
                  : `/s/${encodeURIComponent(shopSlug)}`
              }
              className={SHOP_NAME_LINK_CLASS}
            >
              {tenant.shopDisplayName}
            </Link>
          </p>
        ) : null}
        {variant === "page" ? (
          <h1
            className={
              tenant
                ? "mt-1.5 text-sm font-medium leading-snug text-zinc-100 sm:mt-2 sm:text-base"
                : "m-0 text-sm font-medium leading-snug text-zinc-100 sm:text-base"
            }
          >
            {displayItemName}
          </h1>
        ) : null}
        {variant === "page" ? adminCatalogSubtitle : null}
        <p
          className={
            variant === "page" || tenant
              ? "mt-3 text-2xl text-blue-200/90"
              : "text-2xl text-blue-200/90"
          }
        >
          {formatPrice(displayPriceCents)}
        </p>
        {blurbText ? (
          <p className="mt-6 whitespace-pre-line text-sm italic leading-relaxed text-zinc-300">
            {blurbText}
          </p>
        ) : null}
        <div className={blurbText ? "mt-5" : "mt-6"}>
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Item details</h3>
          {description ? (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-400">{description}</p>
          ) : null}
          <p
            className={`text-sm leading-relaxed text-zinc-500 ${description ? "mt-3" : "mt-2"}`}
          >
            Free shipping
          </p>
        </div>
        {keywordsText ? (
          <p className="mt-8 text-[11px] leading-relaxed text-zinc-600">
            <span className="text-zinc-500">Keywords:</span> {keywordsText}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (variant === "page") {
    return (
      <StoreDocumentPanel
        backHref={allProductsHref}
        backLabel="All products"
        showBackLink={false}
        closeHref={allProductsHref}
        omitHeaderTitle
      >
        {breadcrumb ? <div className="-mt-2">{breadcrumb}</div> : null}
        {grid}
      </StoreDocumentPanel>
    );
  }

  return (
    <>
      {breadcrumb}
      <div className="mb-8">
        <h2
          id="product-modal-title"
          className="store-dimension-page-title text-2xl text-zinc-50 sm:text-3xl"
        >
          {displayItemName}
        </h2>
        {adminCatalogSubtitle}
      </div>
      {grid}
    </>
  );
}
