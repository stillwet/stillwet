/** Listing credit pack ids (purchased via dashboard; credits land on `Shop.listingFeeBonusFreeSlots`). */
export const LISTING_CREDIT_PACK_IDS = ["pack_5", "pack_15", "pack_25"] as const;

export type ListingCreditPackId = (typeof LISTING_CREDIT_PACK_IDS)[number];

export type ListingCreditPack = {
  id: ListingCreditPackId;
  credits: number;
  priceCents: number;
  /** e.g. "5 credits — $5.00" */
  label: string;
};

export const LISTING_CREDIT_PACKS: readonly ListingCreditPack[] = [
  { id: "pack_5", credits: 5, priceCents: 500, label: "5 credits — $5.00" },
  { id: "pack_15", credits: 15, priceCents: 1000, label: "15 credits — $10.00" },
  { id: "pack_25", credits: 25, priceCents: 1500, label: "25 credits — $15.00" },
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
