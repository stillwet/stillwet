import type { AdminOrderReturnClaimRow } from "@/components/admin/AdminOrderReturnClaimsTab";
import { daysSinceOrderPlaced } from "@/lib/order-return-claim-limits";
import { runtimeDatabaseUrlFromEnv } from "@/lib/env-postgres-url";
import { isPrismaMissingRelationError } from "@/lib/prisma-missing-relation";
import { prismaOrderReturnClaimOrNull } from "@/lib/prisma";

function orderReturnClaimMigrationSetupNotice(): string {
  const url = runtimeDatabaseUrlFromEnv() ?? "";
  let local = false;
  try {
    const h = new URL(url).hostname.toLowerCase();
    local = h === "localhost" || h === "127.0.0.1" || h === "[::1]";
  } catch {
    /* ignore */
  }
  if (local) {
    return "Returns tables are not on this local database yet. From the repo root run `npx prisma migrate deploy` (with Docker Postgres up: `npm run db:up`).";
  }
  return "Returns tables are not on this database yet. Apply migration `20260608120000_order_return_claim` (production: `npm run db:migrate:prod` after `vercel env pull`).";
}
export type AdminOrderReturnClaimsLoadResult = {
  rows: AdminOrderReturnClaimRow[];
  setupNotice: string | null;
};

export async function loadAdminOrderReturnClaimRows(): Promise<AdminOrderReturnClaimsLoadResult> {
  const delegate = prismaOrderReturnClaimOrNull();
  if (!delegate) {
    return {
      rows: [],
      setupNotice:
        "Returns tracker is unavailable on this server process (stale Prisma client). Redeploy production, or locally run `npx prisma generate`, delete `.next`, and restart `npm run dev`.",
    };
  }

  try {
    const claims = await delegate.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        order: { select: { createdAt: true } },
        images: { select: { imageUrl: true, sortOrder: true } },
      },
    });

    return {
      rows: claims.map((r) => ({
        id: r.id,
        orderNumber: r.orderNumber,
        orderPlacedAtIso: r.order.createdAt.toISOString(),
        daysSinceOrderPlaced: daysSinceOrderPlaced(r.order.createdAt),
        email: r.email,
        cardLast4: r.cardLast4,
        nameOnOrder: r.nameOnOrder,
        issueType: r.issueType,
        catalogItemName: r.catalogItemName,
        status: r.status,
        rejectionReason: r.rejectionReason ?? null,
        createdAtIso: r.createdAt.toISOString(),
        adminNotes: r.adminNotes,
        images: r.images,
      })),
      setupNotice: null,
    };
  } catch (e) {
    if (isPrismaMissingRelationError(e)) {
      return {
        rows: [],
        setupNotice: orderReturnClaimMigrationSetupNotice(),
      };
    }
    throw e;
  }
}
