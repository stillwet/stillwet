/** Admin-only artwork viewer (streams from R2 API; avoids broken public CDN URLs). */
export function listingRequestArtworkAdminViewUrl(listingId: string, imageIndex: number): string {
  const p = new URLSearchParams({
    listingId,
    i: String(imageIndex),
  });
  return `/api/admin/listing-request-artwork?${p.toString()}`;
}
