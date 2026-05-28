import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Normalized key for uniqueness: trim + lowercase (matches DB index `LOWER(TRIM("displayName"))`). */
export function shopDisplayNameUniquenessKey(displayName: string): string {
  return displayName.trim().toLowerCase();
}

/**
 * Returns another shop’s id if that shop already uses this display name (case-insensitive;
 * leading/trailing spaces ignored). Omits `excludeShopId` when checking renames.
 */
export async function findShopIdConflictingDisplayName(
  displayName: string,
  excludeShopId?: string,
): Promise<string | null> {
  const key = shopDisplayNameUniquenessKey(displayName);
  if (!key) return null;
  const rows = excludeShopId
    ? await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM "Shop"
        WHERE LOWER(TRIM("displayName")) = ${key}
          AND id <> ${excludeShopId}
        LIMIT 1
      `)
    : await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM "Shop"
        WHERE LOWER(TRIM("displayName")) = ${key}
        LIMIT 1
      `);
  return rows[0]?.id ?? null;
}

export const SHOP_DISPLAY_NAME_TAKEN_ERROR =
  "That shop name is already taken. Choose a different name.";
