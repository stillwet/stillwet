/** Google Shopping listing credit packs (purchased on Promotions; credits consumed on enrollment). */
export const GOOGLE_SHOPPING_CREDIT_PACK_IDS = ["gmc_pack_3", "gmc_pack_5", "gmc_pack_10"] as const;

export type GoogleShoppingCreditPackId = (typeof GOOGLE_SHOPPING_CREDIT_PACK_IDS)[number];

export const GOOGLE_SHOPPING_LEGACY_PACK_ID = "legacy_access" as const;

export type GoogleShoppingCreditPack = {
  id: GoogleShoppingCreditPackId;
  credits: number;
  priceCents: number;
  label: string;
};

export const GOOGLE_SHOPPING_CREDIT_PACKS: readonly GoogleShoppingCreditPack[] = [
  { id: "gmc_pack_3", credits: 3, priceCents: 500, label: "3 credits — $5" },
  { id: "gmc_pack_5", credits: 5, priceCents: 700, label: "5 credits — $7" },
  { id: "gmc_pack_10", credits: 10, priceCents: 1000, label: "10 credits — $10" },
] as const;

export function parseGoogleShoppingCreditPackId(raw: string): GoogleShoppingCreditPackId | null {
  const id = raw.trim();
  return (GOOGLE_SHOPPING_CREDIT_PACK_IDS as readonly string[]).includes(id)
    ? (id as GoogleShoppingCreditPackId)
    : null;
}

export function googleShoppingCreditPackById(packId: string): GoogleShoppingCreditPack | null {
  const parsed = parseGoogleShoppingCreditPackId(packId);
  if (!parsed) return null;
  return GOOGLE_SHOPPING_CREDIT_PACKS.find((p) => p.id === parsed) ?? null;
}

export function googleShoppingCreditPackPriceUsdLabel(priceCents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(priceCents / 100);
}
