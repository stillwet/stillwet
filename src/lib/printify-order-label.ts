import { shopDisplayNameForPublicLabel } from "@/lib/shop-display-name-uniqueness";

/** Printify order label shop-name segment max length (full label also includes " - {orderNumber}"). */
export const PRINTIFY_ORDER_LABEL_SHOP_NAME_MAX_LEN = 48;

export function printifyOrderLabel(shopDisplayName: string, orderNumber: number): string {
  const name = shopDisplayNameForPublicLabel(shopDisplayName);
  const truncated =
    name.length > PRINTIFY_ORDER_LABEL_SHOP_NAME_MAX_LEN
      ? `${name.slice(0, PRINTIFY_ORDER_LABEL_SHOP_NAME_MAX_LEN - 1).trimEnd()}…`
      : name;
  return `${truncated} - ${orderNumber}`;
}

export function printifyOrderExternalId(orderNumber: number): string {
  return String(orderNumber);
}
