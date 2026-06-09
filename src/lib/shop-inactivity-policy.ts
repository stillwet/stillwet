/** Days without a creator login before a warning email is sent. */
export const SHOP_INACTIVITY_WARNING_DAYS = 30;
/** Days without a creator login before the shop account is deactivated for dashboard access. */
export const SHOP_INACTIVITY_DEACTIVATE_DAYS = 60;
/** Days after inactivity deactivation during which a creator may pay the reactivation fee (90 days from warning). */
export const SHOP_INACTIVITY_REACTIVATION_WINDOW_DAYS = 30;
/** After this many days deactivated with no sales, the platform may start automated deletion cleanup. */
export const SHOP_INACTIVITY_DELETE_AFTER_DAYS = 365;
export const SHOP_REACTIVATION_FEE_CENTS = 500;
export const SHOP_REACTIVATION_FEE_LABEL = "Shop reactivation fee";

export function daysAgo(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function shopIsInactivityDeactivated(shop: {
  inactivityDeactivatedAt: Date | string | null;
}): boolean {
  return shop.inactivityDeactivatedAt != null;
}

/** True when the paid reactivation window has elapsed since inactivity deactivation. */
export function shopInactivityReactivationWindowExpired(
  inactivityDeactivatedAt: Date | string | null,
  now: Date = new Date(),
): boolean {
  if (!inactivityDeactivatedAt) return false;
  const deactivatedAt =
    inactivityDeactivatedAt instanceof Date ? inactivityDeactivatedAt : new Date(inactivityDeactivatedAt);
  if (Number.isNaN(deactivatedAt.getTime())) return false;
  const elapsedMs = now.getTime() - deactivatedAt.getTime();
  return elapsedMs > SHOP_INACTIVITY_REACTIVATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function splitMerchandiseLineForInactiveShopCents(params: {
  lineMerchandiseCents: number;
  cogsLineCents: number;
  productionFeeLineCents: number;
}): {
  goodsServicesCostCents: number;
  productionFeeCents: number;
  platformCutCents: number;
  shopCutCents: number;
} {
  const line = Math.max(0, Math.round(params.lineMerchandiseCents));
  const cogs = Math.min(line, Math.max(0, Math.round(params.cogsLineCents)));
  const remainingAfterCogs = line - cogs;
  const production = Math.min(
    remainingAfterCogs,
    Math.max(0, Math.round(params.productionFeeLineCents)),
  );
  return {
    goodsServicesCostCents: cogs,
    productionFeeCents: production,
    platformCutCents: line - cogs - production,
    shopCutCents: 0,
  };
}

/** @deprecated Pass separate COGS and production fee lines via {@link splitMerchandiseLineForInactiveShopCents}. */
export function splitMerchandiseLineForInactiveShopFromItemCostCents(params: {
  lineMerchandiseCents: number;
  goodsServicesLineCents: number;
}): { goodsServicesCostCents: number; platformCutCents: number; shopCutCents: number } {
  const split = splitMerchandiseLineForInactiveShopCents({
    lineMerchandiseCents: params.lineMerchandiseCents,
    cogsLineCents: params.goodsServicesLineCents,
    productionFeeLineCents: 0,
  });
  return {
    goodsServicesCostCents: split.goodsServicesCostCents + split.productionFeeCents,
    platformCutCents: split.platformCutCents,
    shopCutCents: split.shopCutCents,
  };
}
