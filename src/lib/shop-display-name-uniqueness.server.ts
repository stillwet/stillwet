import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { shopDisplayNameUniquenessKey } from "@/lib/shop-display-name-uniqueness";

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
        SELECT s.id FROM "Shop" s
        WHERE LOWER(TRIM(s."displayName")) = ${key}
          AND s.id <> ${excludeShopId}
          AND EXISTS (SELECT 1 FROM "ShopUser" u WHERE u."shopId" = s.id)
        LIMIT 1
      `)
    : await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT s.id FROM "Shop" s
        WHERE LOWER(TRIM(s."displayName")) = ${key}
          AND EXISTS (SELECT 1 FROM "ShopUser" u WHERE u."shopId" = s.id)
        LIMIT 1
      `);
  return rows[0]?.id ?? null;
}
