import { prisma } from "@/lib/prisma";
import type { DashboardPromotionsTabSummaryPayload } from "@/lib/dashboard-scoped-data";

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function parseSnapshotPayload(raw: unknown): DashboardPromotionsTabSummaryPayload | null {
  if (!isObject(raw)) return null;
  const purchases = raw.purchases;
  const mockPromotionCheckout = raw.mockPromotionCheckout;
  const stripePublishableKey = raw.stripePublishableKey;
  if (!Array.isArray(purchases)) return null;
  if (typeof mockPromotionCheckout !== "boolean") return null;
  if (stripePublishableKey !== null && typeof stripePublishableKey !== "string") return null;
  const promotionCreditBalances =
    isObject(raw.promotionCreditBalances) || raw.promotionCreditBalances === undefined
      ? ((raw.promotionCreditBalances as DashboardPromotionsTabSummaryPayload["promotionCreditBalances"]) ??
        {})
      : null;
  if (promotionCreditBalances === null) return null;
  return {
    ...(raw as DashboardPromotionsTabSummaryPayload),
    promotionCreditBalances,
  };
}

function snapshotDelegate() {
  const d = (prisma as unknown as { shopPromotionsDashboardSnapshot?: unknown })
    .shopPromotionsDashboardSnapshot as
    | { findUnique?: unknown; upsert?: unknown }
    | undefined;
  if (!d || typeof d.findUnique !== "function" || typeof d.upsert !== "function") return null;
  // Don't access `prisma.shopPromotionsDashboardSnapshot` directly until Prisma client is regenerated.
  return d as unknown as {
    findUnique: (args: unknown) => Promise<{ payload: unknown; builtAt: Date } | null>;
    upsert: (args: unknown) => Promise<unknown>;
  };
}

export async function readShopPromotionsDashboardSnapshot(
  shopId: string,
): Promise<{ ok: true; payload: DashboardPromotionsTabSummaryPayload; builtAtIso: string } | { ok: false }> {
  const delegate = snapshotDelegate();
  if (!delegate) return { ok: false };
  try {
    const row = await delegate.findUnique({
      where: { shopId },
      select: { payload: true, builtAt: true },
    });
    if (!row) return { ok: false };
    const parsed = parseSnapshotPayload(row.payload);
    if (!parsed) return { ok: false };
    return { ok: true, payload: parsed, builtAtIso: row.builtAt.toISOString() };
  } catch (e) {
    console.warn("[promotionsSnapshot] read failed", e);
    return { ok: false };
  }
}

export async function writeShopPromotionsDashboardSnapshot(
  shopId: string,
  payload: DashboardPromotionsTabSummaryPayload,
): Promise<void> {
  const delegate = snapshotDelegate();
  if (!delegate) return;
  await delegate.upsert({
    where: { shopId },
    create: { shopId, payload, builtAt: new Date() },
    update: { payload, builtAt: new Date() },
  });
}

