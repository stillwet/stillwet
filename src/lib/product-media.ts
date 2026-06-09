import type { Prisma } from "@/generated/prisma/client";

/** Max images per product listing (admin + storefront). */
export const MAX_GALLERY = 20;

/** Parse newline- or comma-separated URLs; keep only http(s). */
export function parseImageUrlList(raw: string): string[] {
  const parts = raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const line of parts) {
    try {
      const u = new URL(line);
      if (u.protocol === "http:" || u.protocol === "https:") {
        out.push(line);
      }
    } catch {
      /* skip invalid */
    }
    if (out.length >= MAX_GALLERY) break;
  }
  return out;
}

export function galleryFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const x of value) {
    if (typeof x === "string" && x.trim()) {
      try {
        const u = new URL(x.trim());
        if (u.protocol === "http:" || u.protocol === "https:") out.push(x.trim());
      } catch {
        /* skip */
      }
    }
    if (out.length >= MAX_GALLERY) break;
  }
  return out;
}

export function productImageUrls(product: {
  imageUrl: string | null;
  imageGallery: Prisma.JsonValue | null;
}): string[] {
  const g = galleryFromJson(product.imageGallery);
  if (g.length > 0) return g;
  if (product.imageUrl?.trim()) return [product.imageUrl.trim()];
  return [];
}

/**
 * Like {@link productImageUrls}, but if `imageUrl` is set and missing from the gallery JSON,
 * prepends it. Used for Printify sync so the prior hero is merged and removed from R2 when
 * a new mockup is imported (avoids orphans when gallery and imageUrl were out of sync).
 */
export function productImageUrlsUnionHero(product: {
  imageUrl: string | null;
  imageGallery: Prisma.JsonValue | null;
}): string[] {
  const g = galleryFromJson(product.imageGallery);
  const hero = product.imageUrl?.trim() || "";
  if (!hero) {
    return uniqueImageUrlsOrdered(g);
  }
  const inGallery = g.some((x) => x.trim() === hero);
  if (inGallery) {
    return uniqueImageUrlsOrdered(g);
  }
  return uniqueImageUrlsOrdered([hero, ...g]);
}

/**
 * Hero ∪ gallery image URLs (deduped). Use when deleting R2 listing objects that are no longer referenced.
 */
export function productAllStoredImageUrls(product: {
  imageUrl: string | null;
  imageGallery: Prisma.JsonValue | null;
}): string[] {
  return productImageUrlsUnionHero(product);
}

export function productPrimaryImage(product: {
  imageUrl: string | null;
  imageGallery: Prisma.JsonValue | null;
}): string | null {
  const urls = productImageUrls(product);
  return urls[0] ?? null;
}

/**
 * Parse `ShopListing.listingStorefrontCatalogImageUrls` JSON.
 * Returns `null` when unset or invalid (treat as “show all catalog images”).
 */
export function parseListingStorefrontCatalogImageSelection(value: unknown): string[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const x of value) {
    if (typeof x !== "string" || !x.trim()) continue;
    try {
      const u = new URL(x.trim());
      if (u.protocol === "http:" || u.protocol === "https:") out.push(x.trim());
    } catch {
      /* skip */
    }
    if (out.length >= MAX_GALLERY) break;
  }
  return out;
}

/** Stable key for matching Printify/catalog URLs across minor string differences. */
export function catalogImageUrlKey(u: string): string {
  const s = u.trim();
  try {
    return new URL(s).href;
  } catch {
    return s;
  }
}

function storefrontCatalogImagesFromSelection(
  fullCatalog: string[],
  selected: string[] | null | undefined,
): string[] {
  if (selected === undefined || selected === null) return fullCatalog;
  const byKey = new Map<string, string>();
  for (const u of fullCatalog) {
    const t = u.trim();
    byKey.set(catalogImageUrlKey(t), t);
  }
  const out: string[] = [];
  for (const u of selected) {
    const t = u.trim();
    const canonical = byKey.get(catalogImageUrlKey(t));
    if (canonical) out.push(canonical);
  }
  return uniqueImageUrlsOrdered(out);
}

/**
 * Save path: map submitted URLs onto canonical catalog (and optionally owner supplement) URLs,
 * preserving submit order. When `ownerSupplementUrl` is set but **not** present in `submittedUrls`,
 * output is catalog-only (legacy rows) so {@link productImageUrlsForShopListing} can still append
 * the supplement at the end.
 */
export function listingCatalogUrlsForPersist(
  product: {
    imageUrl: string | null;
    imageGallery: Prisma.JsonValue | null;
  },
  submittedUrls: string[],
  ownerSupplementUrl?: string | null,
): string[] {
  const full = productImageUrlsUnionHero(product);
  const owner = ownerSupplementUrl?.trim() || "";
  if (!owner) {
    return storefrontCatalogImagesFromSelection(full, submittedUrls);
  }
  const ownerKey = catalogImageUrlKey(owner);
  const hasOwnerInSubmitted = submittedUrls.some((u) => catalogImageUrlKey(u.trim()) === ownerKey);
  if (!hasOwnerInSubmitted) {
    return storefrontCatalogImagesFromSelection(full, submittedUrls);
  }

  const byKey = new Map<string, string>();
  for (const u of full) {
    const t = u.trim();
    byKey.set(catalogImageUrlKey(t), t);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of submittedUrls) {
    const t = raw.trim();
    if (!t) continue;
    if (catalogImageUrlKey(t) === ownerKey) {
      if (!seen.has(ownerKey)) {
        out.push(owner);
        seen.add(ownerKey);
      }
      continue;
    }
    const canonical = byKey.get(catalogImageUrlKey(t));
    if (canonical) {
      const ck = catalogImageUrlKey(canonical);
      if (!seen.has(ck)) {
        out.push(canonical);
        seen.add(ck);
      }
    }
  }
  return uniqueImageUrlsOrdered(out);
}

/**
 * Insert size example at gallery index 1 (replaces 2nd Printify mockup), or append when fewer images.
 */
export function injectCatalogSizeExampleIntoGallery(base: string[], sizeExampleUrl: string): string[] {
  const size = sizeExampleUrl.trim();
  if (!size) return uniqueImageUrlsOrdered(base);

  const sizeKey = catalogImageUrlKey(size);
  const withoutDup = base.filter((u) => catalogImageUrlKey(u) !== sizeKey);

  if (withoutDup.length >= 2) {
    return uniqueImageUrlsOrdered([withoutDup[0]!, size, ...withoutDup.slice(1)]);
  }
  if (withoutDup.length === 1) {
    return uniqueImageUrlsOrdered([withoutDup[0]!, size]);
  }
  return [size];
}

/**
 * Storefront gallery: Printify/catalog hero ∪ gallery, optional per-catalog-item size example at index 1.
 * Shop owner supplement and legacy per-listing admin secondary images are not included on storefront.
 */
export function productImageUrlsForShopListing(
  product: {
    imageUrl: string | null;
    imageGallery: Prisma.JsonValue | null;
  },
  extras?: {
    /** Admin List size example photo (replaces 2nd mockup thumbnail when set). */
    adminCatalogSizeExampleImageUrl?: string | null;
    /** @deprecated Use adminCatalogSizeExampleImageUrl */
    adminCatalogReferenceImageUrl?: string | null;
    /** Non-null array = explicit storefront catalog mockup subset. */
    listingStorefrontCatalogImageUrls?: string[] | null;
  },
): string[] {
  const fullBase = productImageUrlsUnionHero(product);
  const sizeExample = (
    extras?.adminCatalogSizeExampleImageUrl ?? extras?.adminCatalogReferenceImageUrl
  )?.trim();
  const parsedSel = parseListingStorefrontCatalogImageSelection(extras?.listingStorefrontCatalogImageUrls);

  let base: string[];
  if (parsedSel === null || parsedSel.length === 0) {
    base = fullBase;
  } else {
    base = storefrontCatalogImagesFromSelection(fullBase, parsedSel);
  }

  if (!sizeExample) {
    return uniqueImageUrlsOrdered(base);
  }
  return injectCatalogSizeExampleIntoGallery(base, sizeExample);
}

export function productPrimaryImageForShopListing(
  product: {
    imageUrl: string | null;
    imageGallery: Prisma.JsonValue | null;
  },
  extras?: {
    adminCatalogSizeExampleImageUrl?: string | null;
    /** @deprecated Use adminCatalogSizeExampleImageUrl */
    adminCatalogReferenceImageUrl?: string | null;
    listingStorefrontCatalogImageUrls?: string[] | null;
  },
): string | null {
  return productImageUrlsForShopListing(product, extras)[0] ?? null;
}

export function toGalleryJson(urls: string[]): Prisma.InputJsonValue {
  return urls;
}

/** Deduplicate image URLs while preserving first-seen order (for storefront galleries). */
export function uniqueImageUrlsOrdered(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const s = typeof u === "string" ? u.trim() : "";
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}
