"use client";

import { useEffect } from "react";
import { schedulePlacementPeriodCalendarPrefetch } from "@/lib/promotion-period-calendar-cache";
import { shouldBackgroundPrefetchPromotions } from "@/lib/promotions-background-prefetch";

/** Starts shared placement period math after first paint when checkout is open (`?buy=`). */
export function PromotionsPagePeriodPrefetch(props: { enabled?: boolean }) {
  const enabled = props.enabled ?? false;
  useEffect(() => {
    if (!enabled) return;
    if (!shouldBackgroundPrefetchPromotions()) return;
    schedulePlacementPeriodCalendarPrefetch();
  }, [enabled]);
  return null;
}
