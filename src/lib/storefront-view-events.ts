import { Prisma } from "@/generated/prisma/client";
import { StorefrontViewTargetKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export async function recordStorefrontViewEvent(args: {
  kind: StorefrontViewTargetKind;
  targetSlug: string;
  weight: number;
}): Promise<boolean> {
  const slug = args.targetSlug.trim();
  if (!slug || args.weight <= 0) return false;

  const delegate = (prisma as { storefrontViewEvent?: { create?: unknown } }).storefrontViewEvent;
  if (!delegate?.create) {
    return legacyIncrementStorefrontView(args);
  }

  try {
    await prisma.storefrontViewEvent.create({
      data: {
        kind: args.kind,
        targetSlug: slug,
        weight: args.weight,
      },
    });
    return true;
  } catch (e) {
    console.error("[storefront-view-events] record failed", e);
    return legacyIncrementStorefrontView(args);
  }
}

async function legacyIncrementStorefrontView(args: {
  kind: StorefrontViewTargetKind;
  targetSlug: string;
  weight: number;
}): Promise<boolean> {
  const slug = args.targetSlug.trim();
  if (!slug || args.weight <= 0) return false;
  if (args.kind === StorefrontViewTargetKind.product) {
    const res = await prisma.product.updateMany({
      where: { slug, active: true },
      data: { storefrontViewCount: { increment: args.weight } },
    });
    return res.count > 0;
  }
  const res = await prisma.shop.updateMany({
    where: { slug, active: true },
    data: { storefrontViewCount: { increment: args.weight } },
  });
  return res.count > 0;
}

/**
 * Applies buffered view events to `Product` / `Shop` counters, then prunes old rows.
 * Run from daily maintenance (not on the request path).
 */
export async function rollupStorefrontViewEvents(): Promise<{
  productRows: number;
  shopRows: number;
  prunedEvents: number;
}> {
  const delegate = (prisma as { storefrontViewEvent?: { groupBy?: unknown } }).storefrontViewEvent;
  if (!delegate?.groupBy) {
    return { productRows: 0, shopRows: 0, prunedEvents: 0 };
  }

  return prisma.$transaction(async (tx) => {
    const [productAgg, shopAgg] = await Promise.all([
      tx.storefrontViewEvent.groupBy({
        by: ["targetSlug"],
        where: { kind: StorefrontViewTargetKind.product },
        _sum: { weight: true },
      }),
      tx.storefrontViewEvent.groupBy({
        by: ["targetSlug"],
        where: { kind: StorefrontViewTargetKind.shop },
        _sum: { weight: true },
      }),
    ]);

    let productRows = 0;
    for (const row of productAgg) {
      const inc = row._sum.weight ?? 0;
      if (inc <= 0) continue;
      const res = await tx.product.updateMany({
        where: { slug: row.targetSlug, active: true },
        data: { storefrontViewCount: { increment: inc } },
      });
      if (res.count > 0) productRows += 1;
    }

    let shopRows = 0;
    for (const row of shopAgg) {
      const inc = row._sum.weight ?? 0;
      if (inc <= 0) continue;
      const res = await tx.shop.updateMany({
        where: { slug: row.targetSlug, active: true },
        data: { storefrontViewCount: { increment: inc } },
      });
      if (res.count > 0) shopRows += 1;
    }

    const pruned = await tx.storefrontViewEvent.deleteMany({});

    return {
      productRows,
      shopRows,
      prunedEvents: pruned.count,
    };
  });
}

/** For tests / ops: full recompute from all retained events (expensive). */
export async function recomputeStorefrontViewCountsFromEvents(): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`UPDATE "Product" SET "storefrontViewCount" = 0`);
  await prisma.$executeRaw(Prisma.sql`UPDATE "Shop" SET "storefrontViewCount" = 0`);
  await rollupStorefrontViewEvents();
}
