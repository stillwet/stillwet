export const ADMIN_ANNOUNCEMENT_KIND = "admin_announcement";
export const ADMIN_ANNOUNCEMENT_MAX_BODY_CHARS = 5000;

export function normalizeAdminAnnouncementBody(raw: string): string {
  return raw.replace(/\r\n/g, "\n").trim();
}

export function validateAdminAnnouncementBody(
  raw: string,
): { ok: true; body: string } | { ok: false; error: string } {
  const body = normalizeAdminAnnouncementBody(raw);
  if (!body) return { ok: false, error: "Announcement message is required." };
  if (body.length > ADMIN_ANNOUNCEMENT_MAX_BODY_CHARS) {
    return {
      ok: false,
      error: `Announcement must be ${ADMIN_ANNOUNCEMENT_MAX_BODY_CHARS.toLocaleString()} characters or fewer.`,
    };
  }
  return { ok: true, body };
}

export function chunkRows<T>(rows: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}
