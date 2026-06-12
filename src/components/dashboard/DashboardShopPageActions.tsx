"use client";

import Link from "next/link";
import { useShopDashboardCompactLayout } from "@/components/dashboard/shop-dashboard-compact-layout";

export const dashboardHeaderActionLinkClass =
  "shrink-0 whitespace-nowrap rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-500";

const dashboardHeaderActionLinkCompactClass =
  "shrink-0 whitespace-nowrap rounded-lg border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition hover:border-zinc-500";
type DashboardShopPageActionsProps = {
  shopSlug: string;
  /** Link back to the main shop dashboard. */
  showDashboardLink?: boolean;
  bugFeedbackHref?: string;
  bugFeedbackActive?: boolean;
};

export function DashboardShopPageActions({
  shopSlug,
  showDashboardLink = false,
  bugFeedbackHref,
  bugFeedbackActive = false,
}: DashboardShopPageActionsProps) {
  const compactLayout = useShopDashboardCompactLayout();
  const actionLinkClass = compactLayout ? dashboardHeaderActionLinkCompactClass : dashboardHeaderActionLinkClass;

  return (
    <div
      className={`ml-auto flex shrink-0 flex-nowrap items-center justify-end ${
        compactLayout ? "gap-x-2" : "gap-x-4"
      }`}
    >
      <a href={`/s/${shopSlug}`} title="View storefront" className={actionLinkClass}>
        {compactLayout ? "Storefront" : "View storefront"}
      </a>      {showDashboardLink ? (
        <Link href="/dashboard" prefetch className={actionLinkClass}>
          Dashboard
        </Link>
      ) : null}
      {bugFeedbackHref ? (
        <Link
          href={bugFeedbackHref}
          prefetch={false}
          scroll={false}
          title="Bug / feedback"
          className={`${actionLinkClass} ${
            bugFeedbackActive
              ? "border-zinc-500 bg-zinc-800/80 text-zinc-100 ring-1 ring-zinc-600"
              : ""
          }`}
        >
          {compactLayout ? "Feedback" : "Bug / feedback"}
        </Link>
      ) : null}    </div>
  );
}
