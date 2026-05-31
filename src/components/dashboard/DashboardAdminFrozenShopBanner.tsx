import Link from "next/link";
import { dashQueryParamForTabId } from "@/lib/dashboard-dash-query";

export function DashboardAdminFrozenShopBanner() {
  const supportHref = `/dashboard?dash=${encodeURIComponent(dashQueryParamForTabId("support"))}`;

  return (
    <div
      className="border-b-2 border-red-700 bg-red-950 px-4 py-5 text-center shadow-lg shadow-red-950/40"
      role="alert"
    >
      <p className="text-lg font-semibold tracking-tight text-red-50 sm:text-xl">
        Shop is frozen. Check support for more info
      </p>
      <Link
        href={supportHref}
        className="mt-3 inline-flex rounded-lg border border-red-400/50 bg-red-900/60 px-4 py-2 text-sm font-medium text-red-50 hover:bg-red-800/80"
      >
        Open Support
      </Link>
    </div>
  );
}
