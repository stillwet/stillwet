export const SHOP_INACTIVITY_WARNING_DAYS = 60;
export const SHOP_INACTIVITY_DEACTIVATE_DAYS = 90;
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

export function splitMerchandiseLineForInactiveShopCents(params: {
  lineMerchandiseCents: number;
  goodsServicesLineCents: number;
}): { goodsServicesCostCents: number; platformCutCents: number; shopCutCents: number } {
  const line = Math.max(0, Math.round(params.lineMerchandiseCents));
  const goods = Math.min(line, Math.max(0, Math.round(params.goodsServicesLineCents)));
  return {
    goodsServicesCostCents: goods,
    platformCutCents: line - goods,
    shopCutCents: 0,
  };
}
