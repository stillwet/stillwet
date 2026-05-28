import { PromotionKind } from "@/generated/prisma/enums";
import type { PlacementCheckoutPromotionKind } from "@/lib/promotion-placement-ui-pure";
import { parsePromotionKind } from "@/lib/promotions";

/** Dashboard promotions picker order (Popular → Hot → Featured shop). */
export const PROMOTION_KIND_LOAD_ORDER: readonly PlacementCheckoutPromotionKind[] = [
  PromotionKind.MOST_POPULAR_OF_TAG_ITEM,
  PromotionKind.HOT_FEATURED_ITEM,
  PromotionKind.FEATURED_SHOP_HOME,
] as const;

const PLACEMENT_CHECKOUT_KIND_SET = new Set<string>(PROMOTION_KIND_LOAD_ORDER);

export function parsePlacementCheckoutBuyKind(
  raw: string | undefined,
): PlacementCheckoutPromotionKind | null {
  const kind = parsePromotionKind(raw ?? "");
  if (kind == null || !PLACEMENT_CHECKOUT_KIND_SET.has(kind)) return null;
  return kind as PlacementCheckoutPromotionKind;
}
