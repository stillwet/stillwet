import { PromotionKind } from "@/generated/prisma/enums";
import { PROMOTION_KIND_OPTIONS, promotionKindLabel } from "@/lib/promotions";

export type AdminAwardDefinition =
  | {
      key: "free_listing_slots";
      catalogKey: "free_listing_slots";
      label: string;
      description: string;
      supportsQuantity: true;
    }
  | {
      key: "flair_access";
      catalogKey: "flair_access";
      label: string;
      description: string;
      supportsQuantity: false;
    }
  | {
      key: "google_shopping_credits";
      catalogKey: "google_shopping_credits";
      label: string;
      description: string;
      supportsQuantity: true;
    }
  | {
      key: "promotion_credit";
      catalogKey: string;
      promotionKind: PromotionKind;
      label: string;
      description: string;
      supportsQuantity: true;
    };

export function promotionCreditAwardKey(kind: PromotionKind): string {
  return `promotion_credit:${kind}`;
}

export function parseAdminAwardCatalogKey(raw: string): AdminAwardDefinition | null {
  const t = raw.trim();
  for (const def of adminAwardCatalog()) {
    if (def.catalogKey === t) return def;
  }
  return null;
}

/** Single source for admin award UI and server validation. */
export function adminAwardCatalog(): AdminAwardDefinition[] {
  return [
    {
      key: "free_listing_slots",
      catalogKey: "free_listing_slots",
      label: "Free listing slots",
      description: "Bonus publication-fee-free listing slots (stack on the platform default).",
      supportsQuantity: true,
    },
    {
      key: "flair_access",
      catalogKey: "flair_access",
      label: "Shop flair access",
      description: "Unlocks flair selection on the shop dashboard (one-time per shop).",
      supportsQuantity: false,
    },
    {
      key: "google_shopping_credits",
      catalogKey: "google_shopping_credits",
      label: "Google Shopping credits",
      description:
        "Listing enrollment credits for Google Shopping on Shop upgrades (1 credit = 1 listing).",
      supportsQuantity: true,
    },
    ...PROMOTION_KIND_OPTIONS.map((o) => ({
      key: "promotion_credit" as const,
      catalogKey: promotionCreditAwardKey(o.kind),
      promotionKind: o.kind,
      label: `${o.label} credit`,
      description: `Redeemable ${promotionKindLabel(o.kind).toLowerCase()} placement credit (no Stripe at checkout).`,
      supportsQuantity: true as const,
    })),
  ];
}

export function adminAwardGrantQuantityBounds(def: AdminAwardDefinition): {
  min: number;
  max: number;
} {
  if (!def.supportsQuantity) return { min: 1, max: 1 };
  if (def.key === "free_listing_slots") return { min: 1, max: 500 };
  return { min: 1, max: 100 };
}
