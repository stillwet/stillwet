import { Prisma, type PrismaClient } from "@/generated/prisma/client";

/**
 * 1-based position of each listing within its shop when ordered by `createdAt` asc, then `id` asc.
 * Used for publication-fee tiering (creator dashboard, listing credit checks).
 *
 * Implemented with per-row counts instead of loading every listing id for involved shops — the
 * latter degrades badly when a shop has a large catalog but only a few queue rows.
 */
export async function listingOrdinalByListingId(
  prismaClient: PrismaClient,
  listingIds: readonly string[],
): Promise<Map<string, number>> {
  const unique = [...new Set(listingIds)];
  if (unique.length === 0) return new Map();

  const rows = await prismaClient.$queryRaw<{ id: string; ordinal: number }[]>`
    SELECT l.id,
      (
        SELECT COUNT(*)::int
        FROM "ShopListing" x
        WHERE x."shopId" = l."shopId"
          AND (x."createdAt", x.id) <= (l."createdAt", l.id)
      ) AS ordinal
    FROM "ShopListing" l
    WHERE l.id IN (${Prisma.join(unique.map((id) => Prisma.sql`${id}`))})
  `;

  const out = new Map<string, number>();
  for (const row of rows) {
    out.set(row.id, row.ordinal);
  }
  return out;
}
