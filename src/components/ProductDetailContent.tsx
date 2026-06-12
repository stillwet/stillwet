import Link from "next/link";
import { ProductDetailAddToCart } from "@/components/ProductDetailAddToCart";
import { productImageUrlsForShopListing } from "@/lib/product-media";
import { ProductImageGallery } from "@/components/ProductImageGallery";
import { ProductModalDetailGrid } from "@/components/ProductModalDetailGrid";
import {
  PRODUCT_PDP_DETAIL_GRID_CLASS,
  PRODUCT_PDP_DETAILS_COLUMN_CLASS,
  PRODUCT_PDP_PAGE_ADD_TO_CART_CLASS,
  PRODUCT_PDP_PAGE_GALLERY_CLASS,
  PRODUCT_PDP_PAGE_GALLERY_HERO_CLASS,
} from "@/lib/product-image-gallery-constants";
import { StoreDocumentPanel } from "@/components/StoreDocumentPanel";
import { SHOP_ALL_ROUTE } from "@/lib/constants";
import type { StorefrontProduct } from "@/lib/product-storefront";
import { PLATFORM_SHOP_SLUG, shopAllProductsHref, shopUniversalTagHref } from "@/lib/marketplace-constants";
import {
  firstLinkedAdminCatalogItemName,
  storefrontListingDisplayTitle,
} from "@/lib/storefront-listing-display-name";

const SHOP_NAME_LINK_CLASS =
  "pdp-detail-shop-name store-dimension-brand uppercase tracking-[0.2em] text-blue-400/80 transition hover:text-blue-300/90";

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
  adminCatalogSizeExampleImageUrl,
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
  /** Per-catalog-item size example photo (tenant PDP only). */
  adminCatalogSizeExampleImageUrl?: string | null;
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
    <p className="pdp-detail-subtitle mt-1 font-normal leading-snug text-zinc-500">
      {resolvedAdminCatalogItemName}
    </p>
  ) : null;
  const displayPriceCents = tenant?.listingPriceCents ?? product.priceCents;

  const images = productImageUrlsForShopListing(product, {
    adminCatalogSizeExampleImageUrl,
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

  const detailsColumn = (
    <>
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
              ? "pdp-detail-title mt-1.5 font-medium leading-snug text-zinc-100 sm:mt-2"
              : "pdp-detail-title m-0 font-medium leading-snug text-zinc-100"
          }
        >
          {displayItemName}
        </h1>
      ) : null}
      {variant === "page" ? adminCatalogSubtitle : null}
      <p
        className={`pdp-detail-price text-blue-200/90 ${
          variant === "page" || tenant ? "mt-3" : ""
        }`}
      >
        {formatPrice(displayPriceCents)}
      </p>
      {blurbText ? (
        <p className="pdp-detail-blurb mt-3 whitespace-pre-line italic text-zinc-300">
          {blurbText}
        </p>
      ) : null}
      <div className={blurbText ? "mt-5" : "mt-6"}>
        <h3 className="pdp-detail-section-label font-medium uppercase tracking-wide text-zinc-500">
          Item details
        </h3>
        {description ? (
          <p className="pdp-detail-description mt-2 whitespace-pre-line text-zinc-400">{description}</p>
        ) : null}
        <p
          className={`pdp-detail-shipping text-zinc-500 ${description ? "mt-3" : "mt-2"}`}
        >
          Free shipping
        </p>
      </div>
      {keywordsText ? (
        <div className="pdp-detail-keywords-slot">
          <p className="pdp-detail-keywords text-zinc-600">
            <span className="text-zinc-500">Keywords:</span> {keywordsText}
          </p>
        </div>
      ) : null}
    </>
  );

  const grid =
    variant === "modal" ? (
      <ProductModalDetailGrid
        galleryHeightKey={images.join("\u001f")}
        gallery={
          <ProductImageGallery
            images={images}
            sizeReferenceImageUrl={adminCatalogSizeExampleImageUrl}
          />
        }
        details={detailsColumn}
        addToCart={
          purchaseDisabled ? null : (
            <ProductDetailAddToCart
              productId={product.id}
              shopSlug={shopSlug === PLATFORM_SHOP_SLUG ? undefined : shopSlug}
              variant={variant}
            />
          )
        }
      />
    ) : (
      <div className={PRODUCT_PDP_DETAIL_GRID_CLASS}>
        <div className={PRODUCT_PDP_PAGE_GALLERY_CLASS}>
          <div className={PRODUCT_PDP_PAGE_GALLERY_HERO_CLASS}>
            <ProductImageGallery
              images={images}
              sizeReferenceImageUrl={adminCatalogSizeExampleImageUrl}
            />
          </div>
          {purchaseDisabled ? null : (
            <div className={PRODUCT_PDP_PAGE_ADD_TO_CART_CLASS}>
              <ProductDetailAddToCart
                productId={product.id}
                shopSlug={shopSlug === PLATFORM_SHOP_SLUG ? undefined : shopSlug}
                variant={variant}
              />
            </div>
          )}
        </div>
        <div className={PRODUCT_PDP_DETAILS_COLUMN_CLASS}>{detailsColumn}</div>
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
        panelPaddingClass="px-5 sm:px-8 md:px-10"
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
