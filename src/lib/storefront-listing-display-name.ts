type ProductWithOptionalAdminLinks = {
  slug: string;
  adminCatalogItemPlatformLinks?: { name: string }[] | null;
};

export function firstLinkedAdminCatalogItemName(
  product: ProductWithOptionalAdminLinks,
): string | null {
  const n = (product.adminCatalogItemPlatformLinks ?? [])
    .map((x) => x.name?.trim())
    .find(Boolean);
  return n && n.length > 0 ? n : null;
}

export function titleFromProductSlug(slug: string): string {
  const t = slug
    .split("-")
    .filter(Boolean)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
    .join(" ")
    .trim();
  return t || "Item";
}

/**
 * Storefront title for a listing: shop `requestItemName`, else admin list template name, else slug title.
 * Never uses Printify-synced `Product.name`.
 */
export function storefrontListingDisplayTitle(input: {
  requestItemName?: string | null;
  adminCatalogItemName?: string | null;
  product: ProductWithOptionalAdminLinks;
}): string {
  const custom = input.requestItemName?.trim();
  if (custom) return custom;
  const adminExplicit = input.adminCatalogItemName?.trim();
  if (adminExplicit) return adminExplicit;
  const fromLinks = firstLinkedAdminCatalogItemName(input.product);
  if (fromLinks) return fromLinks;
  return titleFromProductSlug(input.product.slug);
}
