import {
  GOOGLE_SHOPPING_ADMIN_GRANT_PACK_ID,
  GOOGLE_SHOPPING_LEGACY_PACK_ID,
  googleShoppingCreditPackById,
  googleShoppingCreditPackPriceUsdLabel,
} from "@/lib/google-shopping-credit-packs";

export const SHOP_GOOGLE_SHOPPING_PURCHASE_HISTORY_KIND = "SHOP_GOOGLE_SHOPPING_PACK";

/** @deprecated Use pack-specific labels via `shopGoogleShoppingPurchaseHistoryLabel`. */
export const SHOP_GOOGLE_SHOPPING_ACCESS_PURCHASE_HISTORY_KIND = "SHOP_GOOGLE_SHOPPING_ACCESS";

export function shopGoogleShoppingPurchaseHistoryLabel(row?: {
  packId?: string | null;
  creditsGranted?: number | null;
}): string {
  if (row?.packId === GOOGLE_SHOPPING_ADMIN_GRANT_PACK_ID) {
    const n = row.creditsGranted ?? 1;
    return `Google Shopping — ${n} listing credit${n === 1 ? "" : "s"} (admin grant)`;
  }
  if (row?.packId && row.packId !== GOOGLE_SHOPPING_LEGACY_PACK_ID) {
    const pack = googleShoppingCreditPackById(row.packId);
    if (pack) {
      const n = row.creditsGranted ?? pack.credits;
      return `Google Shopping — ${n} listing credit${n === 1 ? "" : "s"} (${googleShoppingCreditPackPriceUsdLabel(pack.priceCents)})`;
    }
  }
  const n = row?.creditsGranted;
  if (typeof n === "number" && n > 0) {
    return `Google Shopping — ${n} listing credit${n === 1 ? "" : "s"}`;
  }
  return "Google Shopping credits";
}

export function shopGoogleShoppingPackPurchaseLabel(packId: string): string {
  if (packId === GOOGLE_SHOPPING_ADMIN_GRANT_PACK_ID) {
    return "Google Shopping — admin grant";
  }
  const pack = googleShoppingCreditPackById(packId);
  if (!pack) return "Google Shopping credits";
  return `Google Shopping — ${pack.label}`;
}

export function isShopGoogleShoppingPurchaseHistoryRow(row: {
  purchaseType?: string;
  kind: string;
}): boolean {
  return (
    row.purchaseType === "shop_google_shopping" ||
    row.kind === SHOP_GOOGLE_SHOPPING_PURCHASE_HISTORY_KIND ||
    row.kind === SHOP_GOOGLE_SHOPPING_ACCESS_PURCHASE_HISTORY_KIND
  );
}

export async function shopHasGoogleShoppingEnrollment(
  db: { shopListingGoogleShoppingEnrollment: { count: (args: object) => Promise<number> } },
  shopId: string,
): Promise<boolean> {
  const count = await db.shopListingGoogleShoppingEnrollment.count({
    where: { shopId },
  });
  return count > 0;
}
