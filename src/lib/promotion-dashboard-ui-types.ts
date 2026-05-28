import type { PlacementPeriodChoiceUi } from "@/lib/promotion-placement-ui-pure";

/** Checkout period row (no DB) — shared by promotions page and legacy listings UI. */
export type PromotionMonthlySlotUi = {
  monthlyCap: number;
  slotsUsedUtcThisMonth: number;
  periodChoices: PlacementPeriodChoiceUi[];
  offerError: string | null;
  offer: {
    amountCents: number;
    eligibleFromIso: string | null;
    isDeferred: boolean;
    isSecondFuturePeriod?: boolean;
    isProrated?: boolean;
    placementMonthLabel: string;
  } | null;
};

/** @deprecated Alias of {@link PromotionMonthlySlotUi}. */
export type PopularItemPromotionUi = PromotionMonthlySlotUi;

export type DashboardPromotionPurchaseRow = {
  id: string;
  kind: string;
  status: string;
  amountCents: number;
  createdAtIso: string;
  paidAtIso: string | null;
  expiresAtIso?: string | null;
  eligibleFromIso: string | null;
  activeWindowPacificRange: string | null;
  listingLabel: string | null;
};
