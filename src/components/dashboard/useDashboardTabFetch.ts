"use client";

import { useCallback, useRef, useState } from "react";
import type { DashboardSupportChatPayload } from "@/lib/dashboard-scoped-data";
import { pacificCalendarDateKey } from "@/lib/promotion-period-pacific";
import type {
  DashboardListingRow,
  DashboardNoticeRow,
  DashboardPaidOrderRow,
} from "@/components/dashboard/DashboardMainTabs";
import type { DraftListingRequestPrefillPayload } from "@/lib/shop-baseline-draft-prefill";
import type { ShopSetupCatalogGroup } from "@/lib/shop-baseline-catalog";
import type { GroupedDashboardListing } from "@/lib/dashboard-legacy-baseline-listing-groups";
import type { FreeListingRequestSlotsSummary } from "@/lib/marketplace-constants";
import type { UnpaidPublicationFeeListingRow } from "@/lib/listing-fee-unpaid-rows";

const SALES_PERIOD_STORAGE_KEY = "dashboard_sales_period_key";

export type DashboardTabLoadedFlags = {
  listings: boolean;
  orders: boolean;
  notifications: boolean;
  support: boolean;
  requestListingCatalog: boolean;
};

type TabFetchId = keyof DashboardTabLoadedFlags;

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "same-origin" });
  if (!r.ok) throw new Error(String(r.status));
  return r.json() as Promise<T>;
}

function readSalesPeriodGate(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(SALES_PERIOD_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeSalesPeriodGate(periodKey: string) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(SALES_PERIOD_STORAGE_KEY, periodKey);
  } catch {
    /* ignore */
  }
}

export function useDashboardTabFetch(options: {
  isPlatform: boolean;
  enabled: boolean;
}) {
  const { isPlatform, enabled } = options;
  const inflightRef = useRef<Partial<Record<TabFetchId, Promise<void>>>>({});

  const [loadedFlags, setLoadedFlags] = useState<DashboardTabLoadedFlags>({
    listings: false,
    orders: false,
    notifications: false,
    support: false,
    requestListingCatalog: false,
  });

  const [listings, setListings] = useState<DashboardListingRow[]>([]);
  const [groupedListingSections, setGroupedListingSections] = useState<{
    live: GroupedDashboardListing<DashboardListingRow>[];
    request: GroupedDashboardListing<DashboardListingRow>[];
    removed: GroupedDashboardListing<DashboardListingRow>[];
  }>({ live: [], request: [], removed: [] });
  const [paidOrders, setPaidOrders] = useState<DashboardPaidOrderRow[]>([]);
  const [notifications, setNotifications] = useState<{
    rows: DashboardNoticeRow[];
    unreadCount: number;
  } | null>(null);
  const [supportChat, setSupportChat] = useState<DashboardSupportChatPayload | null>(null);
  const [requestListingCatalog, setRequestListingCatalog] = useState<{
    catalogGroups: ShopSetupCatalogGroup[];
    draftListingRequestPrefill: DraftListingRequestPrefillPayload | null;
    adminCatalogItemCount: number;
    unpaidPublicationFeeListings: UnpaidPublicationFeeListingRow[];
    freeListingSlots: FreeListingRequestSlotsSummary;
  } | null>(null);
  const [moderationKeywordPhrases, setModerationKeywordPhrases] = useState<string[]>([]);
  const [tabLoadError, setTabLoadError] = useState<string | null>(null);
  const [failedTabs, setFailedTabs] = useState<Partial<Record<TabFetchId, boolean>>>({});

  const markLoaded = useCallback((tab: TabFetchId) => {
    setLoadedFlags((f) => ({ ...f, [tab]: true }));
  }, []);

  const loadTab = useCallback(
    async (tab: TabFetchId, options?: { force?: boolean }) => {
      if (!enabled) return;

      if (tab === "orders" && !isPlatform) {
        const today = pacificCalendarDateKey();
        if (!options?.force && readSalesPeriodGate() === today && loadedFlags.orders) return;
      } else if (!options?.force && loadedFlags[tab]) {
        return;
      }

      const existing = inflightRef.current[tab];
      if (existing) {
        await existing;
        if (!options?.force) return;
      }

      const run = (async () => {
        setTabLoadError(null);
        try {
          if (tab === "listings") {
            const data = await fetchJson<{
              listings: DashboardListingRow[];
              groupedListingSections: typeof groupedListingSections;
              moderationKeywordPhrases: string[];
            }>("/api/dashboard/listings");
            setListings(data.listings);
            setGroupedListingSections(data.groupedListingSections);
            setModerationKeywordPhrases(data.moderationKeywordPhrases ?? []);
            markLoaded("listings");
            return;
          }
          if (tab === "orders") {
            const data = await fetchJson<{ orders: DashboardPaidOrderRow[] }>("/api/dashboard/orders");
            setPaidOrders(data.orders);
            markLoaded("orders");
            if (!isPlatform) {
              writeSalesPeriodGate(pacificCalendarDateKey());
            }
            return;
          }
          if (tab === "notifications") {
            const data = await fetchJson<{
              notifications: { rows: DashboardNoticeRow[]; unreadCount: number } | null;
            }>("/api/dashboard/notifications");
            setNotifications(data.notifications);
            markLoaded("notifications");
            return;
          }
          if (tab === "support") {
            const data = await fetchJson<{ supportChat: DashboardSupportChatPayload | null }>(
              "/api/dashboard/support",
            );
            setSupportChat(data.supportChat);
            markLoaded("support");
            return;
          }
          if (tab === "requestListingCatalog") {
            const data = await fetchJson<{
              requestListingCatalog: NonNullable<typeof requestListingCatalog>;
              moderationKeywordPhrases: string[];
            }>("/api/dashboard/request-listing");
            setRequestListingCatalog(data.requestListingCatalog);
            setModerationKeywordPhrases((prev) =>
              prev.length > 0 ? prev : (data.moderationKeywordPhrases ?? []),
            );
            markLoaded("requestListingCatalog");
          }
        } catch {
          setTabLoadError("Could not load this tab. Try again.");
          setFailedTabs((f) => ({ ...f, [tab]: true }));
          markLoaded(tab);
        } finally {
          delete inflightRef.current[tab];
        }
      })();

      inflightRef.current[tab] = run;
      await run;
    },
    [enabled, isPlatform, loadedFlags, markLoaded],
  );

  const retryTab = useCallback(
    (tab: TabFetchId) => {
      setFailedTabs((f) => ({ ...f, [tab]: false }));
      setLoadedFlags((f) => ({ ...f, [tab]: false }));
      delete inflightRef.current[tab];
      void loadTab(tab, { force: true });
    },
    [loadTab],
  );

  return {
    loadedFlags,
    listings,
    groupedListingSections,
    paidOrders,
    notifications,
    supportChat,
    requestListingCatalog,
    moderationKeywordPhrases,
    tabLoadError,
    failedTabs,
    retryTab,
    loadTab,
  };
}
