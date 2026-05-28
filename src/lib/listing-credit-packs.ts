/** Listing credit pack ids (purchased via dashboard; credits land on `Shop.listingFeeBonusFreeSlots`). */
export const LISTING_CREDIT_PACK_IDS = ["pack_10", "pack_25", "pack_50"] as const;

export type ListingCreditPackId = (typeof LISTING_CREDIT_PACK_IDS)[number];

export type ListingCreditPack = {
  id: ListingCreditPackId;
  credits: number;
  priceCents: number;
  /** e.g. "10 listing credits — $5.00" */
  label: string;
};

export const LISTING_CREDIT_PACKS: readonly ListingCreditPack[] = [
  { id: "pack_10", credits: 10, priceCents: 500, label: "10 listing credits — $5.00" },
  { id: "pack_25", credits: 25, priceCents: 1000, label: "25 listing credits — $10.00" },
  { id: "pack_50", credits: 50, priceCents: 1500, label: "50 listing credits — $15.00" },
] as const;

export function parseListingCreditPackId(raw: string): ListingCreditPackId | null {
  const id = raw.trim();
  return (LISTING_CREDIT_PACK_IDS as readonly string[]).includes(id) ? (id as ListingCreditPackId) : null;
}

export function listingCreditPackById(packId: string): ListingCreditPack | null {
  const parsed = parseListingCreditPackId(packId);
  if (!parsed) return null;
  return LISTING_CREDIT_PACKS.find((p) => p.id === parsed) ?? null;
}
