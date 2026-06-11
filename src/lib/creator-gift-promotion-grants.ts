import type { PromotionKind } from "@/generated/prisma/enums";
import {
  PROMOTION_KIND_OPTIONS,
  parsePromotionKind,
  promotionPriceCentsForKind,
} from "@/lib/promotions";

export type CreatorGiftPromotionGrantLine = {
  kind: PromotionKind;
  credits: number;
};

export const MAX_PROMOTION_GIFT_CREDITS_PER_KIND = 10;

const PROMOTION_GIFT_KINDS = new Set(PROMOTION_KIND_OPTIONS.map((o) => o.kind));

export function promotionGrantFormFieldName(kind: PromotionKind): string {
  return `promotionCredits_${kind}`;
}

export function parsePromotionGrantsFromFormData(formData: FormData): CreatorGiftPromotionGrantLine[] {
  const grants: CreatorGiftPromotionGrantLine[] = [];
  for (const option of PROMOTION_KIND_OPTIONS) {
    const raw = String(formData.get(promotionGrantFormFieldName(option.kind)) ?? "0").trim();
    const credits = Number.parseInt(raw, 10);
    if (!Number.isFinite(credits) || credits <= 0) continue;
    grants.push({ kind: option.kind, credits });
  }
  return grants;
}

export function parsePromotionGrantFromRaw(
  kindRaw: string,
  creditsRaw: unknown,
): CreatorGiftPromotionGrantLine | null {
  const kind = parsePromotionKind(kindRaw);
  if (!kind || !PROMOTION_GIFT_KINDS.has(kind)) return null;
  const credits =
    typeof creditsRaw === "number"
      ? creditsRaw
      : Number.parseInt(String(creditsRaw ?? "").trim(), 10);
  if (!Number.isFinite(credits) || credits <= 0) return null;
  return { kind, credits };
}

export function validatePromotionGrants(
  grants: CreatorGiftPromotionGrantLine[],
  includePromotionCredits: boolean,
): string | null {
  if (!includePromotionCredits) return null;
  if (grants.length === 0) {
    return "Choose at least one upgrade credit quantity greater than zero.";
  }
  for (const grant of grants) {
    if (!PROMOTION_GIFT_KINDS.has(grant.kind)) {
      return "Choose a valid promotion type.";
    }
    if (
      !Number.isFinite(grant.credits) ||
      grant.credits < 1 ||
      grant.credits > MAX_PROMOTION_GIFT_CREDITS_PER_KIND
    ) {
      return `Enter promotion credits between 1 and ${MAX_PROMOTION_GIFT_CREDITS_PER_KIND} for each upgrade type.`;
    }
  }
  return null;
}

export function promotionGrantsMerchandiseCents(grants: CreatorGiftPromotionGrantLine[]): number {
  return grants.reduce(
    (sum, grant) => sum + promotionPriceCentsForKind(grant.kind) * grant.credits,
    0,
  );
}

export function promotionGrantsTotalCredits(grants: CreatorGiftPromotionGrantLine[]): number {
  return grants.reduce((sum, grant) => sum + grant.credits, 0);
}

export function promotionGrantsDistinctKindCount(grants: CreatorGiftPromotionGrantLine[]): number {
  return new Set(grants.map((g) => g.kind)).size;
}

type PurchaseWithLegacyPromotion = {
  promotionKind?: PromotionKind | null;
  promotionCreditsGranted?: number;
  promotionGrants?: CreatorGiftPromotionGrantLine[];
};

/** Grants from relation when present; otherwise legacy single-kind columns on the purchase row. */
export function promotionGrantsFromPurchase(
  purchase: PurchaseWithLegacyPromotion,
): CreatorGiftPromotionGrantLine[] {
  if (purchase.promotionGrants && purchase.promotionGrants.length > 0) {
    return purchase.promotionGrants.filter((g) => g.credits > 0);
  }
  const promotionKind = purchase.promotionKind ?? null;
  const promotionCreditsGranted = purchase.promotionCreditsGranted ?? 0;
  if (promotionKind && promotionCreditsGranted > 0) {
    return [{ kind: promotionKind, credits: promotionCreditsGranted }];
  }
  return [];
}

/** Mirror legacy columns when exactly one grant kind (backward-compatible queries). */
export function legacyPromotionFieldsFromGrants(grants: CreatorGiftPromotionGrantLine[]): {
  promotionKind: PromotionKind | null;
  promotionCreditsGranted: number;
} {
  if (grants.length === 1) {
    return {
      promotionKind: grants[0]!.kind,
      promotionCreditsGranted: grants[0]!.credits,
    };
  }
  return { promotionKind: null, promotionCreditsGranted: 0 };
}
