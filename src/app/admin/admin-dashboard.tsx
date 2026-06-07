import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAdminSessionReadonly } from "@/lib/session";
import { logoutAdmin } from "@/actions/admin";
import {
  ADMIN_BACKEND_BASE_PATH,
  ADMIN_MAIN_BASE_PATH,
} from "@/lib/admin-dashboard-urls";
import { ensureBaselineAdminCatalogIfEmpty } from "@/lib/seed-baseline-admin-catalog";
import { prisma } from "@/lib/prisma";
import {
  AdminDashboardTabPanel,
  AdminDashboardTabPanelFallback,
} from "./admin-dashboard-tab-panel";
import { AdminListTab } from "@/components/admin/AdminListTab";
import { AdminBetaTestersTabLoader } from "@/components/admin/AdminBetaTestersTabLoader";
import { AdminWaivedShopFeesTabLoader } from "@/components/admin/AdminWaivedShopFeesTabLoader";
import { AdminShopFlairsTabLoader } from "@/components/admin/AdminShopFlairsTabLoader";
import { AdminGoogleShoppingTabLoader } from "@/components/admin/AdminGoogleShoppingTabLoader";
import { AdminShopWatchTabLoader } from "@/components/admin/AdminShopWatchTabLoader";
import { AdminPromotionListsTabLoader } from "@/components/admin/AdminPromotionListsTabLoader";
import { AdminPlatformSalesTabLoader } from "@/components/admin/AdminPlatformSalesTabLoader";
import { AdminNexusPlanningTabLoader } from "@/components/admin/AdminNexusPlanningTabLoader";
import { printifyHookBannerFromSearchParams } from "@/lib/admin-printify-hook-banner";
import { PrintifyApiTab } from "./printify-api-tab";
import {
  AdminMainEmptyDbBanner,
  AdminMainNavCount,
  AdminShellCountsProvider,
} from "@/components/admin/AdminMainShellClient";
import { AdminDatabaseConfigPanel } from "@/components/admin/AdminDatabaseConfigPanel";
import { AdminPurgeListingRequestAvatarsR2Button } from "@/components/admin/AdminPurgeListingRequestAvatarsR2Button";
import {
  productionLocalhostDatabaseUrlKeys,
  runtimeDatabaseUrlFromEnv,
} from "@/lib/env-postgres-url";
export const dynamic = "force-dynamic";

export type AdminDashboardSection = "main" | "backend";

type AdminDashboardProps = {
  adminSection: AdminDashboardSection;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function AdminDashboardPageSuspenseFallback(props: { adminSection: AdminDashboardSection }) {
  return (
    <div className="mx-auto max-w-[1040px] px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-500">
            {props.adminSection === "main" ? "Admin Dash" : "Backend admin"}
          </p>
          <h1 className="mt-1 text-xl font-semibold text-zinc-100">Loading…</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Loading admin shell. Tab content streams in below once you choose a section.
          </p>
        </div>
        <span
          className="inline-block h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-violet-500/90"
          aria-hidden
        />
      </div>

      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950/40 p-6">
        <div className="h-4 w-40 rounded bg-zinc-900/70" />
        <div className="mt-4 h-24 rounded bg-zinc-900/40" />
      </div>
    </div>
  );
}

export async function AdminDashboardPageContent({
  adminSection,
  searchParams,
}: AdminDashboardProps) {
  const session = await getAdminSessionReadonly();
  if (!session.isAdmin) {
    redirect("/admin/login");
  }

  return (
    <Suspense fallback={<AdminDashboardPageSuspenseFallback adminSection={adminSection} />}>
      <AdminDashboardPageBody adminSection={adminSection} searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminDashboardPageBody({
  adminSection,
  searchParams,
}: AdminDashboardProps) {
  const sp = await searchParams;
  const tabParam = typeof sp.tab === "string" ? sp.tab : undefined;

  const mainTabLiterals = [
    "support",
    "admin-inbox",
    "requests",
    "custom-images",
    "bug-feedback",
    "shop-watch",
    "beta-testers",
    "waived-shop-fees",
    "promotion-lists",
    "shop-leaderboard",
    "sales",
    "nexus-planning",
  ] as const;
  const backendTabLiterals = [
    "announcements",
    "award-promotions",
    "free-listings",
    "admin-list",
    "printify",
    "flairs",
    "google-shopping",
    "removed",
    "email-format",
    "cron-jobs",
    "keyword-triggers",
    "tags",
    "printify-api",
  ] as const;

  if (
    adminSection === "main" &&
    tabParam &&
    (backendTabLiterals as readonly string[]).includes(tabParam)
  ) {
    const q = new URLSearchParams();
    for (const [key, raw] of Object.entries(sp)) {
      if (typeof raw === "string" && raw) q.set(key, raw);
      else if (Array.isArray(raw)) {
        const first = raw.find((x) => typeof x === "string" && x);
        if (typeof first === "string") q.set(key, first);
      }
    }
    redirect(`${ADMIN_BACKEND_BASE_PATH}?${q.toString()}`);
  }

  if (
    adminSection === "backend" &&
    tabParam &&
    (mainTabLiterals as readonly string[]).includes(tabParam)
  ) {
    const q = new URLSearchParams();
    for (const [key, raw] of Object.entries(sp)) {
      if (typeof raw === "string" && raw) q.set(key, raw);
      else if (Array.isArray(raw)) {
        const first = raw.find((x) => typeof x === "string" && x);
        if (typeof first === "string") q.set(key, first);
      }
    }
    redirect(`${ADMIN_MAIN_BASE_PATH}?${q.toString()}`);
  }

  if (adminSection === "backend" && tabParam === "orders") {
    const q = new URLSearchParams();
    for (const [key, raw] of Object.entries(sp)) {
      if (key === "tab") continue;
      if (typeof raw === "string" && raw) q.set(key, raw);
      else if (Array.isArray(raw)) {
        const first = raw.find((x) => typeof x === "string" && x);
        if (typeof first === "string") q.set(key, first);
      }
    }
    const qs = q.toString();
    redirect(`${ADMIN_BACKEND_BASE_PATH}${qs ? `?${qs}` : ""}`);
  }

  /** Removed tab — send bookmarks to Promotion lists (browse featured shops UI). */
  if (adminSection === "main" && tabParam === "home-top-shops") {
    const q = new URLSearchParams();
    for (const [key, raw] of Object.entries(sp)) {
      if (key === "tab") {
        q.set("tab", "promotion-lists");
        continue;
      }
      if (typeof raw === "string" && raw) q.set(key, raw);
      else if (Array.isArray(raw)) {
        const first = raw.find((x) => typeof x === "string" && x);
        if (typeof first === "string") q.set(key, first);
      }
    }
    redirect(`${ADMIN_MAIN_BASE_PATH}?${q.toString()}`);
  }

  /** Legacy tab name — Award Promotions. */
  if (adminSection === "backend" && tabParam === "free-listings") {
    const q = new URLSearchParams();
    for (const [key, raw] of Object.entries(sp)) {
      if (key === "tab") {
        q.set("tab", "award-promotions");
        continue;
      }
      if (typeof raw === "string" && raw) q.set(key, raw);
      else if (Array.isArray(raw)) {
        const first = raw.find((x) => typeof x === "string" && x);
        if (typeof first === "string") q.set(key, first);
      }
    }
    redirect(`${ADMIN_BACKEND_BASE_PATH}?${q.toString()}`);
  }

  type InventoryTab =
    | (typeof mainTabLiterals)[number]
    | (typeof backendTabLiterals)[number];

  const inventoryTabLiterals =
    adminSection === "main" ? mainTabLiterals : backendTabLiterals;
  const inventoryTab: InventoryTab | null =
    tabParam != null && (inventoryTabLiterals as readonly string[]).includes(tabParam)
      ? (tabParam as InventoryTab)
      : null;

  if (adminSection === "backend" && inventoryTab == null) {
    const q = new URLSearchParams();
    for (const [key, raw] of Object.entries(sp)) {
      if (typeof raw === "string" && raw) q.set(key, raw);
      else if (Array.isArray(raw)) {
        const first = raw.find((x) => typeof x === "string" && x);
        if (typeof first === "string") q.set(key, first);
      }
    }
    q.set("tab", "admin-list");
    redirect(`${ADMIN_BACKEND_BASE_PATH}?${q.toString()}`);
  }

  if (!runtimeDatabaseUrlFromEnv()) {
    return (
      <AdminDatabaseConfigPanel localhostEnvKeys={productionLocalhostDatabaseUrlKeys()} />
    );
  }

  // Baseline catalog seed only where the admin list / requests tab needs it — not every main visit.
  const needsBaselineCatalogSeed =
    inventoryTab === "requests" ||
    (adminSection === "backend" && inventoryTab === "admin-list");
  const baselinePromise = needsBaselineCatalogSeed
    ? (async () => {
        try {
          await ensureBaselineAdminCatalogIfEmpty(prisma);
        } catch (e) {
          console.error("[admin] ensureBaselineAdminCatalogIfEmpty failed", e);
        }
      })()
    : Promise.resolve();

  const basePath =
    adminSection === "main" ? ADMIN_MAIN_BASE_PATH : ADMIN_BACKEND_BASE_PATH;

  await baselinePromise;

  return (
    <AdminShellCountsProvider adminSection={adminSection}>
    <div className="space-y-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-2">
          <h1 className="text-xl font-semibold">
            {adminSection === "main" ? "Admin Dash" : "Backend admin"}
          </h1>
          {adminSection === "main" ? (
            <Link
              prefetch={false}
              href={ADMIN_BACKEND_BASE_PATH}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-300"
            >
              Backend admin →
            </Link>
          ) : (
            <Link
              prefetch={false}
              href={`${ADMIN_MAIN_BASE_PATH}?tab=support`}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-300"
            >
              ← Admin Dash
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          <AdminPurgeListingRequestAvatarsR2Button />
          <form action={logoutAdmin}>
            <button
              type="submit"
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Log out
            </button>
          </form>
        </div>
      </div>

      {adminSection === "main" ? <AdminMainEmptyDbBanner /> : null}

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40">
        <nav
          className={`border-b border-zinc-800 ${adminSection === "main" || adminSection === "backend" ? "" : "flex flex-nowrap gap-1 overflow-x-auto px-2 pt-2"}`}
          aria-label={adminSection === "main" ? "Admin Dash sections" : "Backend admin sections"}
        >
          {adminSection === "main" ? (
            <div className="space-y-2 pb-2 pl-0 pr-2 pt-2">
              <div>
                <div className="grid w-full grid-cols-6 gap-1">
                  <Link
                    href={`${basePath}?tab=requests`}
                    role="tab"
                    title="Count matches the Requests list (excludes approved listings that are already paid or in a free slot)."
                    aria-selected={inventoryTab === "requests"}
                    className={`flex min-h-10 min-w-0 items-center justify-center rounded-t-lg px-2 py-3 text-center text-sm font-medium leading-tight transition ${
                      inventoryTab === "requests"
                        ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                        : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
                    }`}
                  >
                    Listing requests
                    <AdminMainNavCount field="listingRequests" />
                  </Link>
                  <Link
                    href={`${basePath}?tab=custom-images`}
                    role="tab"
                    aria-selected={inventoryTab === "custom-images"}
                    className={`flex min-h-10 min-w-0 items-center justify-center rounded-t-lg px-2 py-3 text-center text-sm font-medium leading-tight transition ${
                      inventoryTab === "custom-images"
                        ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                        : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
                    }`}
                  >
                    Image requests
                    <AdminMainNavCount field="supplementPending" />
                  </Link>
                  <Link
                    href={`${basePath}?tab=support`}
                    role="tab"
                    aria-selected={inventoryTab === "support"}
                    className={`flex min-h-10 min-w-0 items-center justify-center rounded-t-lg px-2 py-3 text-center text-sm font-medium leading-tight transition ${
                      inventoryTab === "support"
                        ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                        : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
                    }`}
                  >
                    Support
                    <AdminMainNavCount field="supportUnresolved" />
                  </Link>
                  <Link
                    href={`${basePath}?tab=admin-inbox`}
                    role="tab"
                    aria-selected={inventoryTab === "admin-inbox"}
                    className={`flex min-h-10 min-w-0 items-center justify-center rounded-t-lg px-2 py-3 text-center text-sm font-medium leading-tight transition ${
                      inventoryTab === "admin-inbox"
                        ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                        : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
                    }`}
                  >
                    Inbox
                    <AdminMainNavCount field="adminInbox" />
                  </Link>
                  <Link
                    href={`${basePath}?tab=bug-feedback`}
                    role="tab"
                    aria-selected={inventoryTab === "bug-feedback"}
                    className={`flex min-h-10 min-w-0 items-center justify-center rounded-t-lg px-2 py-3 text-center text-sm font-medium leading-tight transition ${
                      inventoryTab === "bug-feedback"
                        ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                        : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
                    }`}
                  >
                    Bug/Feedback
                    <AdminMainNavCount field="bugFeedbackOpen" />
                  </Link>
                  <Link
                    href={`${basePath}?tab=nexus-planning`}
                    role="tab"
                    aria-selected={inventoryTab === "nexus-planning"}
                    className={`flex min-h-10 min-w-0 items-center justify-center rounded-t-lg px-2 py-3 text-center text-sm font-medium leading-tight transition ${
                      inventoryTab === "nexus-planning"
                        ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                        : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
                    }`}
                  >
                    Nexus Planning
                  </Link>
                </div>
              </div>
              <div className="border-t border-zinc-800/80 pt-2">
                <div className="grid w-full grid-cols-6 gap-1">
                  <Link
                    href={`${basePath}?tab=shop-watch`}
                    role="tab"
                    aria-selected={inventoryTab === "shop-watch"}
                    className={`flex min-h-10 min-w-0 items-center justify-center rounded-t-lg px-2 py-3 text-center text-sm font-medium leading-tight transition ${
                      inventoryTab === "shop-watch"
                        ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                        : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
                    }`}
                  >
                    Shop Data
                    <AdminMainNavCount field="shopWatch" variant="muted" />
                  </Link>
                  <Link
                    href={`${basePath}?tab=beta-testers`}
                    role="tab"
                    aria-selected={inventoryTab === "beta-testers"}
                    className={`flex min-h-10 min-w-0 items-center justify-center rounded-t-lg px-2 py-3 text-center text-sm font-medium leading-tight transition ${
                      inventoryTab === "beta-testers"
                        ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                        : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
                    }`}
                  >
                    Beta testers
                  </Link>
                  <Link
                    href={`${basePath}?tab=waived-shop-fees`}
                    role="tab"
                    aria-selected={inventoryTab === "waived-shop-fees"}
                    className={`flex min-h-10 min-w-0 items-center justify-center rounded-t-lg px-2 py-3 text-center text-sm font-medium leading-tight transition ${
                      inventoryTab === "waived-shop-fees"
                        ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                        : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
                    }`}
                  >
                    Waived shop fees
                  </Link>
                  <Link
                    href={`${basePath}?tab=promotion-lists`}
                    role="tab"
                    title="Count is paid merchant placements currently in their active window (Hot item, Featured shop home, Popular item, Front page)."
                    aria-selected={inventoryTab === "promotion-lists"}
                    className={`flex min-h-10 min-w-0 items-center justify-center rounded-t-lg px-2 py-3 text-center text-sm font-medium leading-tight transition ${
                      inventoryTab === "promotion-lists"
                        ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                        : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
                    }`}
                  >
                    Promotion Rank
                    <AdminMainNavCount field="promotionLists" variant="muted" />
                  </Link>
                  <Link
                    href={`${basePath}?tab=shop-leaderboard`}
                    role="tab"
                    aria-selected={inventoryTab === "shop-leaderboard"}
                    className={`flex min-h-10 min-w-0 items-center justify-center rounded-t-lg px-2 py-3 text-center text-sm font-medium leading-tight transition ${
                      inventoryTab === "shop-leaderboard"
                        ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                        : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
                    }`}
                  >
                    Shop leaderboard
                    <AdminMainNavCount field="shopLeaderboard" variant="muted" />
                  </Link>
                  <Link
                    href={`${basePath}?tab=sales`}
                    role="tab"
                    title="Badge count is new platform sales in the last 24 hours: items sold (merchandise qty), publication fees, and paid promotions. The sales tab can filter by date separately."
                    aria-selected={inventoryTab === "sales"}
                    className={`flex min-h-10 min-w-0 items-center justify-center rounded-t-lg px-2 py-3 text-center text-sm font-medium leading-tight transition ${
                      inventoryTab === "sales"
                        ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                        : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
                    }`}
                  >
                    Platform sales
                    <AdminMainNavCount field="platformSales" variant="muted" />
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 pb-2 pl-0 pr-2 pt-2">
              <div className="flex flex-wrap items-center justify-start gap-1">
          <Link
            href={`${basePath}?tab=announcements`}
            role="tab"
            aria-selected={inventoryTab === "announcements"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "announcements"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Announcements
          </Link>
          <Link
            href={`${basePath}?tab=award-promotions`}
            role="tab"
            aria-selected={inventoryTab === "award-promotions"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "award-promotions"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Award Promotions
          </Link>
          <Link
            href={`${basePath}?tab=admin-list`}
            role="tab"
            aria-selected={inventoryTab === "admin-list"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "admin-list"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Admin list
          </Link>
          <Link
            href={`${basePath}?tab=printify`}
            role="tab"
            aria-selected={inventoryTab === "printify"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "printify"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Printify items
          </Link>
          <Link
            href={`${basePath}?tab=flairs`}
            role="tab"
            aria-selected={inventoryTab === "flairs"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "flairs"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Flairs
          </Link>
          <Link
            href={`${basePath}?tab=google-shopping`}
            role="tab"
            aria-selected={inventoryTab === "google-shopping"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "google-shopping"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Google Shopping
          </Link>
              </div>
              <div className="border-t border-zinc-800/80 pt-2">
                <div className="flex flex-wrap gap-1">
          <Link
            href={`${basePath}?tab=removed`}
            role="tab"
            aria-selected={inventoryTab === "removed"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "removed"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Removed items
          </Link>
          <Link
            href={`${basePath}?tab=email-format`}
            role="tab"
            aria-selected={inventoryTab === "email-format"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "email-format"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Email format
          </Link>
          <Link
            href={`${basePath}?tab=cron-jobs`}
            role="tab"
            aria-selected={inventoryTab === "cron-jobs"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "cron-jobs"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Cron jobs
          </Link>
          <Link
            href={`${basePath}?tab=keyword-triggers`}
            role="tab"
            aria-selected={inventoryTab === "keyword-triggers"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "keyword-triggers"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Keyword triggers
          </Link>
          <Link
            href={`${basePath}?tab=tags`}
            role="tab"
            aria-selected={inventoryTab === "tags"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "tags"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Tags
          </Link>
          <Link
            href={`${basePath}?tab=printify-api`}
            role="tab"
            aria-selected={inventoryTab === "printify-api"}
            className={`shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
              inventoryTab === "printify-api"
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-b-0 ring-zinc-700"
                : "text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
            }`}
          >
            Printify API
          </Link>
                </div>
              </div>
            </div>
          )}
        </nav>

        <div className="p-4 pt-6 sm:p-6">
          {inventoryTab == null ? (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 p-6 text-sm text-zinc-500">
              {adminSection === "main"
                ? "Select a tab to load its data. Badge counts refresh in the background."
                : "Select a tab to load its data."}
            </div>
          ) : adminSection === "backend" && inventoryTab === "admin-list" ? (
            <Suspense fallback={<AdminDashboardTabPanelFallback />}>
              <AdminListTab />
            </Suspense>
          ) : adminSection === "backend" && inventoryTab === "printify-api" ? (
            <Suspense fallback={<AdminDashboardTabPanelFallback />}>
              <PrintifyApiTab hookBanner={printifyHookBannerFromSearchParams(sp)} />
            </Suspense>
          ) : adminSection === "backend" && inventoryTab === "flairs" ? (
            <Suspense fallback={<AdminDashboardTabPanelFallback />}>
              <AdminShopFlairsTabLoader />
            </Suspense>
          ) : adminSection === "backend" && inventoryTab === "google-shopping" ? (
            <Suspense fallback={<AdminDashboardTabPanelFallback />}>
              <AdminGoogleShoppingTabLoader />
            </Suspense>
          ) : adminSection === "main" && inventoryTab === "shop-watch" ? (
            <Suspense fallback={<AdminDashboardTabPanelFallback />}>
              <AdminShopWatchTabLoader sp={sp} />
            </Suspense>
          ) : adminSection === "main" && inventoryTab === "beta-testers" ? (
            <Suspense fallback={<AdminDashboardTabPanelFallback />}>
              <AdminBetaTestersTabLoader />
            </Suspense>
          ) : adminSection === "main" && inventoryTab === "waived-shop-fees" ? (
            <Suspense fallback={<AdminDashboardTabPanelFallback />}>
              <AdminWaivedShopFeesTabLoader />
            </Suspense>
          ) : adminSection === "main" && inventoryTab === "promotion-lists" ? (
            <Suspense fallback={<AdminDashboardTabPanelFallback />}>
              <AdminPromotionListsTabLoader />
            </Suspense>
          ) : adminSection === "main" && inventoryTab === "sales" ? (
            <Suspense fallback={<AdminDashboardTabPanelFallback />}>
              <AdminPlatformSalesTabLoader sp={sp} />
            </Suspense>
          ) : adminSection === "main" && inventoryTab === "nexus-planning" ? (
            <Suspense fallback={<AdminDashboardTabPanelFallback />}>
              <AdminNexusPlanningTabLoader />
            </Suspense>
          ) : (
            <Suspense fallback={<AdminDashboardTabPanelFallback />}>
              <AdminDashboardTabPanel
                adminSection={adminSection}
                inventoryTab={inventoryTab}
                sp={sp}
              />
            </Suspense>
          )}
        </div>
      </div>

      <Link href="/" className="text-xs text-zinc-600 hover:underline">
        ← Home
      </Link>
    </div>
    </AdminShellCountsProvider>
  );
}
