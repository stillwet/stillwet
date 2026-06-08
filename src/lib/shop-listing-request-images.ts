export type ShopListingRequestImageEntry = {
  surfaceId: string;
  url: string;
};

export type ShopListingRequestImagesV2 = ShopListingRequestImageEntry[];

/** Normalize legacy string[] or v2 object[] to entries. */
export function parseShopListingRequestImages(requestImages: unknown): ShopListingRequestImagesV2 {
  if (!Array.isArray(requestImages)) return [];
  const out: ShopListingRequestImagesV2 = [];
  for (const row of requestImages) {
    if (typeof row === "string") {
      const url = row.trim();
      if (url) out.push({ surfaceId: "front", url });
      continue;
    }
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const url = String(o.url ?? "").trim();
    const surfaceId = String(o.surfaceId ?? "front").trim() || "front";
    if (url) out.push({ surfaceId, url });
  }
  return out;
}

export function shopListingRequestImageUrlStrings(requestImages: unknown): string[] {
  return parseShopListingRequestImages(requestImages).map((e) => e.url);
}

export function shopListingRequestImagesToDbJson(
  entries: ShopListingRequestImagesV2,
): ShopListingRequestImagesV2 | string[] {
  if (entries.length === 0) return [];
  const multiSurface = entries.length > 1 || entries.some((e) => e.surfaceId !== "front");
  if (!multiSurface) {
    return entries.map((e) => e.url);
  }
  return entries.map((e) => ({ surfaceId: e.surfaceId, url: e.url }));
}

export function shopListingRequestImageLabel(surfaceId: string): string {
  const id = surfaceId.trim().toLowerCase();
  if (id === "front") return "Front";
  if (id === "back") return "Back";
  return surfaceId.trim() || "Artwork";
}

export type ListingArtworkBakedFormEntry = {
  surfaceId: string;
  requestImageKey: string;
  publicUrl: string;
};

export function parseListingArtworkBakedEntriesFromForm(raw: unknown): ListingArtworkBakedFormEntry[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: ListingArtworkBakedFormEntry[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const surfaceId = String(o.surfaceId ?? "").trim();
      const requestImageKey = String(o.requestImageKey ?? "").trim();
      const publicUrl = String(o.publicUrl ?? "").trim();
      if (surfaceId && requestImageKey && publicUrl) {
        out.push({ surfaceId, requestImageKey, publicUrl });
      }
    }
    return out;
  } catch {
    return [];
  }
}
