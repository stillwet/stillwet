import type { ShopSetupCatalogGroup } from "@/lib/shop-baseline-catalog";
import { sortShopBaselineCatalogGroupsByNameAsc } from "@/lib/shop-baseline-catalog";

/** Shop-facing section header — intentionally neutral (not “secret menu”). */
export const SHOP_EXTENDED_CATALOG_SECTION_LABEL = "Extended catalog";

export function shopHasSecretMenuAccess(shop: {
  secretMenuAccessGrantedAt: Date | null;
}): boolean {
  return shop.secretMenuAccessGrantedAt != null;
}

export function parseAdminCatalogItemSecretMenuOnlyForm(raw: FormData | string): boolean {
  const value =
    typeof raw === "string"
      ? raw
      : String(raw.get("itemSecretMenuOnly") ?? "").trim();
  return value === "1" || value === "true" || value === "on";
}

export function sortExtendedCatalogGroups(groups: ShopSetupCatalogGroup[]): ShopSetupCatalogGroup[] {
  return sortShopBaselineCatalogGroupsByNameAsc(groups);
}
