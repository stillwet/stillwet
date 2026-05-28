"use client";

import Link from "next/link";
import type { DashboardPromotionsTabSummaryPayload } from "@/lib/dashboard-promotions-tab-types";
import type { DashboardPromotionsCheckoutEnv } from "@/lib/dashboard-promotions-checkout-env";
import {
  DASHBOARD_PROMOTIONS_PATH,
  DASHBOARD_SHOP_UPGRADES_LABEL,
} from "@/lib/dashboard-promotions-path";
import { PromotionsPickerShell } from "@/components/dashboard/PromotionsPickerShell";
import { PromotionsHistoryCollapsed } from "@/components/dashboard/promotions/PromotionsHistoryCollapsed";

export type PromotionsTabClientBodyProps = {
  initialSummary?: DashboardPromotionsTabSummaryPayload | null;
  checkoutEnv?: DashboardPromotionsCheckoutEnv;
};

/** Rare dashboard-tab fallback — static picker links to the shop upgrades page. */
export function PromotionsTabClientBody({ checkoutEnv }: PromotionsTabClientBodyProps = {}) {
  if (checkoutEnv == null) {
    return (
      <div className="mt-2 space-y-3 rounded-md border border-amber-900/40 bg-amber-950/20 px-3 py-3 text-sm text-amber-100/90">
        <p>{DASHBOARD_SHOP_UPGRADES_LABEL} could not be initialized. Refresh this page.</p>
      </div>
    );
  }
  return (
    <>
      <PromotionsPickerShell />
      <p className="mt-2 text-[11px] text-zinc-500">
        <Link href={DASHBOARD_PROMOTIONS_PATH} className="text-violet-300/90 hover:text-violet-200">
          Open {DASHBOARD_SHOP_UPGRADES_LABEL.toLowerCase()}
        </Link>{" "}
        to choose a period and pay.
      </p>
      <PromotionsHistoryCollapsed />
    </>
  );
}
