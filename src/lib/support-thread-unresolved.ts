import { SupportMessageAuthor } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";

/**
 * Shop ids whose support thread needs admin attention: has at least one message and either never
 * marked resolved, or the creator posted again after `resolvedAt`.
 *
 * Implemented as one SQL query so admin does not load every support message into memory (that scaled
 * poorly as traffic grew).
 */
export async function supportUnresolvedThreadShopIdsExcludingPlatform(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ shopId: string }[]>`
    SELECT DISTINCT st."shopId"
    FROM "SupportThread" st
    INNER JOIN "Shop" s ON s.id = st."shopId"
    WHERE s.slug <> ${PLATFORM_SHOP_SLUG}
      AND (
        (
          st."resolvedAt" IS NULL
          AND EXISTS (SELECT 1 FROM "SupportMessage" m WHERE m."threadId" = st.id)
        )
        OR EXISTS (
          SELECT 1 FROM "SupportMessage" m2
          WHERE m2."threadId" = st.id
            AND m2."authorRole" = ${SupportMessageAuthor.creator}
            AND m2."createdAt" > st."resolvedAt"
        )
      )
  `;
  return new Set(rows.map((r) => r.shopId));
}
