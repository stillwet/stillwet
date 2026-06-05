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
 * Storefront gallery: Printify/catalog hero ∪ gallery, optional admin secondary, optional owner
 * supplement. When `listingStorefrontCatalogImageUrls` is **null** (unset), uses full catalog
 * then admin then owner (legacy). When it is a **non-null** array that does **not** include the
 * owner supplement URL, treats it as a catalog-only subset and still appends owner at the end
 * (legacy persisted rows). When the array **does** include the owner URL, order is taken from that
 * list (so the custom image can be primary).
 */
export function productImageUrlsForShopListing(
  product: {
    imageUrl: string | null;
    imageGallery: Prisma.JsonValue | null;
  },
  extras?: {
    adminListingSecondaryImageUrl?: string | null;
    ownerSupplementImageUrl?: string | null;
    /** Non-null array = explicit storefront image order (catalog subset and/or owner supplement). */
    listingStorefrontCatalogImageUrls?: string[] | null;
  },
): string[] {
  const fullBase = productImageUrlsUnionHero(product);
  const admin = extras?.adminListingSecondaryImageUrl?.trim();
  const owner = extras?.ownerSupplementImageUrl?.trim();
  const parsedSel = parseListingStorefrontCatalogImageSelection(extras?.listingStorefrontCatalogImageUrls);

  if (parsedSel === null) {
    return uniqueImageUrlsOrdered([
      ...fullBase,
      ...(admin ? [admin] : []),
      ...(owner ? [owner] : []),
    ]);
  }
  if (parsedSel.length === 0) {
    return uniqueImageUrlsOrdered([
      ...fullBase,
      ...(admin ? [admin] : []),
      ...(owner ? [owner] : []),
    ]);
  }

  const ownerKey = owner ? catalogImageUrlKey(owner) : "";
  const hasOwnerInSelection = owner && parsedSel.some((u) => catalogImageUrlKey(u.trim()) === ownerKey);

  if (owner && !hasOwnerInSelection) {
    const base = storefrontCatalogImagesFromSelection(fullBase, parsedSel);
    return uniqueImageUrlsOrdered([
      ...base,
      ...(admin ? [admin] : []),
      ...(owner ? [owner] : []),
    ]);
  }

  const base = listingCatalogUrlsForPersist(
    { imageUrl: product.imageUrl, imageGallery: product.imageGallery },
    parsedSel,
    owner || null,
  );
  const adminTail =
    admin && !base.some((u) => catalogImageUrlKey(u) === catalogImageUrlKey(admin)) ? [admin] : [];
  return uniqueImageUrlsOrdered([...base, ...adminTail]);
}

/** Catalog / Printify images first, then one optional owner supplement URL (deduped). */
export function productImageUrlsWithOwnerSupplement(
  product: {
    imageUrl: string | null;
    imageGallery: Prisma.JsonValue | null;
  },
  ownerSupplementImageUrl: string | null | undefined,
): string[] {
  return productImageUrlsForShopListing(product, { ownerSupplementImageUrl });
}

export function productPrimaryImageWithOwnerSupplement(
  product: {
    imageUrl: string | null;
    imageGallery: Prisma.JsonValue | null;
  },
  ownerSupplementImageUrl: string | null | undefined,
): string | null {
  const urls = productImageUrlsWithOwnerSupplement(product, ownerSupplementImageUrl);
  return urls[0] ?? null;
}

export function productPrimaryImageForShopListing(
  product: {
    imageUrl: string | null;
    imageGallery: Prisma.JsonValue | null;
  },
  extras?: {
    adminListingSecondaryImageUrl?: string | null;
    ownerSupplementImageUrl?: string | null;
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
