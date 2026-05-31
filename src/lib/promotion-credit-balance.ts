import { PromotionKind } from "@/generated/prisma/enums";
import {
  prismaShopPromotionCreditBalanceOrNull,
} from "@/lib/prisma";

export type PromotionCreditBalancesByKind = Partial<Record<PromotionKind, number>>;

export async function getPromotionCreditBalancesForShop(
  shopId: string,
): Promise<PromotionCreditBalancesByKind> {
  const delegate = prismaShopPromotionCreditBalanceOrNull();
  if (!delegate) return {};

  try {
    const rows = await delegate.findMany({
      where: { shopId, credits: { gt: 0 } },
      select: { kind: true, credits: true },
    });
    const out: PromotionCreditBalancesByKind = {};
    for (const row of rows) {
      out[row.kind] = row.credits;
    }
    return out;
  } catch (e) {
    console.error(
      "[getPromotionCreditBalancesForShop] query failed (apply migration 20260528160000_shop_admin_award_promotions?)",
      e,
    );
    return {};
  }
}

export async function incrementPromotionCreditBalance(
  shopId: string,
  kind: PromotionKind,
  quantity: number,
): Promise<number> {
  const delegate = prismaShopPromotionCreditBalanceOrNull();
  if (!delegate) {
    throw new Error(
      "Award Promotions tables are not available. Run `npx prisma migrate deploy` on this database.",
    );
  }

  const row = await delegate.upsert({
    where: { shopId_kind: { shopId, kind } },
    create: { shopId, kind, credits: quantity },
    update: { credits: { increment: quantity } },
    select: { credits: true },
  });
  return row.credits;
}

export async function decrementPromotionCreditBalance(
  shopId: string,
  kind: PromotionKind,
  quantity: number,
): Promise<number> {
  const delegate = prismaShopPromotionCreditBalanceOrNull();
  if (!delegate) {
    throw new Error(
      "Award Promotions tables are not available. Run `npx prisma migrate deploy` on this database.",
    );
  }

  const current = await delegate.findUnique({
    where: { shopId_kind: { shopId, kind } },
    select: { credits: true },
  });
  const nextCredits = Math.max(0, (current?.credits ?? 0) - quantity);

  const row = await delegate.upsert({
    where: { shopId_kind: { shopId, kind } },
    create: { shopId, kind, credits: 0 },
    update: { credits: nextCredits },
    select: { credits: true },
  });
  return row.credits;
}

/** Atomically consume one credit; returns false if none available. */
export async function consumePromotionCredit(
  shopId: string,
  kind: PromotionKind,
): Promise<boolean> {
  const delegate = prismaShopPromotionCreditBalanceOrNull();
  if (!delegate) return false;

  try {
    const updated = await delegate.updateMany({
      where: { shopId, kind, credits: { gt: 0 } },
      data: { credits: { decrement: 1 } },
    });
    return updated.count > 0;
  } catch (e) {
    console.error("[consumePromotionCredit] query failed", e);
    return false;
  }
}

export async function getPromotionCreditBalance(
  shopId: string,
  kind: PromotionKind,
): Promise<number> {
  const delegate = prismaShopPromotionCreditBalanceOrNull();
  if (!delegate) return 0;

  try {
    const row = await delegate.findUnique({
      where: { shopId_kind: { shopId, kind } },
      select: { credits: true },
    });
    return Math.max(0, row?.credits ?? 0);
  } catch (e) {
    console.error("[getPromotionCreditBalance] query failed", e);
    return 0;
  }
}
