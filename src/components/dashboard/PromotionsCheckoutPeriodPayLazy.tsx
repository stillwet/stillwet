"use client";

import type { ComponentProps } from "react";
import { PromotionsCheckoutPeriodPaySection } from "@/components/dashboard/PromotionsCheckoutPeriodPaySection";

/** In-tab period + pay. */
export function PromotionsCheckoutPeriodPayLazy(
  props: ComponentProps<typeof PromotionsCheckoutPeriodPaySection>,
) {
  return <PromotionsCheckoutPeriodPaySection {...props} />;
}
