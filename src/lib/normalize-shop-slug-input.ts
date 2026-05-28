/** Normalize admin/creator shop slug input (plain slug, @slug, or `/s/slug` URL). */
export function normalizeShopSlugInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const fromPath = trimmed.match(/\/s\/([^/?#]+)/i);
  if (fromPath?.[1]) return fromPath[1].trim().toLowerCase();
  return trimmed.replace(/^@/, "").toLowerCase();
}
