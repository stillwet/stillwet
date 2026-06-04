import { Suspense } from "react";
import { DashboardTabsSuspenseFallback } from "@/app/dashboard/DashboardPageSuspenseFallback";
import {
  DashboardMainTabs,
  type DashboardListingRow,
  type DashboardPaidOrderRow,
} from "@/components/dashboard/DashboardMainTabs";
import { loadBadgeCounts, type DashboardScope } from "@/lib/dashboard-scoped-data";
import { shopDemoPurchaseFeatureEnabled } from "@/lib/shop-demo-purchase-feature";
import { isMockCheckoutEnabled } from "@/lib/checkout-mock";
import { isR2UploadConfigured } from "@/lib/r2-upload";
import type { DashboardMainTabId } from "@/lib/dashboard-main-tab-id";
import type { ShopSetupCatalogGroup } from "@/lib/shop-baseline-catalog";
import type { ShopSetupSteps, ShopSetupShopPayload } from "@/components/dashboard/ShopSetupTabs";
import type { DashboardShopAccountPayload } from "@/components/dashboard/DashboardShopAccountPanel";

/** Creator onboarding props merged with catalog chunks inside {@link DashboardDeferredTabsIsland}. */
export type CreatorDashboardSetupPayload = {
  setupTabsKey: string;
  incompleteSetupCount: number;
  stripeConnectUnlocked: boolean;
  steps: ShopSetupSteps;
  shopPanel: ShopSetupShopPayload;
  itemGuidelinesAcknowledged: boolean;
  needsListingCreditForNextRequest: boolean;
  stripeConnectReadyForPaidListings: boolean;
};

export type DashboardDeferredTabsIslandProps = {
  shopId: string;
  shopSlug: string;
  isPlatform: boolean;
  /** `/admin` session active in this browser (separate from shop owner login). */
  adminLoggedIn: boolean;
  scopes: DashboardScope[];
  dashTab: DashboardMainTabId;
  dashboardQueryPreserve: string;
  listingFeeBonusFreeSlots: number;
  stripePublishableKey: string | null;
  shopStripeConnectReadyForCharges: boolean;
  creatorSetup: CreatorDashboardSetupPayload | null;
  shopAccount: DashboardShopAccountPayload | null;
};

const emptyGroupedSections = { live: [], request: [], removed: [] };

function buildDashboardMainTabsProps(
  props: DashboardDeferredTabsIslandProps,
  notificationsUnreadCount: number,
  supportNewFromStaffCount: number,
) {
  const {
    shopSlug,
    isPlatform,
    adminLoggedIn,
    scopes,
    dashTab,
    dashboardQueryPreserve,
    listingFeeBonusFreeSlots,
    stripePublishableKey,
    shopStripeConnectReadyForCharges,
    creatorSetup,
    shopAccount,
  } = props;

  const listingRows: DashboardListingRow[] = [];
  const groupedListingSections = emptyGroupedSections;
  const paidOrders: DashboardPaidOrderRow[] = [];
  const notificationsPayload = null;
  const supportChatPayload = null;
  const catalogGroups: ShopSetupCatalogGroup[] = [];
  const draftListingRequestPrefill = null;

  const showDemoPurchaseButton = !isPlatform && shopDemoPurchaseFeatureEnabled() && adminLoggedIn;
  const mockListingFeeCheckout = !isPlatform && isMockCheckoutEnabled();

  return {
    initialTab: dashTab,
    dashboardQueryPreserve,
    shopSlug,
    supportNewFromStaffCount: !isPlatform ? supportNewFromStaffCount : 0,
    supportChat: supportChatPayload,
    draftListingRequestPrefill,
    groupedListingSections,
    listingFeeBonusFreeSlots,
    setup:
      creatorSetup != null
        ? {
            setupTabsKey: creatorSetup.setupTabsKey,
            shop: creatorSetup.shopPanel,
            itemGuidelinesAcknowledged: creatorSetup.itemGuidelinesAcknowledged,
            catalogGroups,
            steps: creatorSetup.steps,
            stripeConnectUnlocked: creatorSetup.stripeConnectUnlocked,
            incompleteSetupCount: creatorSetup.incompleteSetupCount,
            r2Configured: isR2UploadConfigured(),
            listingPickerDiagnostics: {
              adminCatalogItemCount: 0,
            },
            needsListingCreditForNextRequest: creatorSetup.needsListingCreditForNextRequest,
            stripeConnectReadyForPaidListings: creatorSetup.stripeConnectReadyForPaidListings,
            unpaidPublicationFeeListings: [],
            freeListingSlots: {
              cap: 3,
              remaining: 3,
              listingCreditsAvailable: 0,
              founderUnlimited: false,
            },
          }
        : null,
    isPlatform,
    r2Configured: isR2UploadConfigured(),
    mockListingFeeCheckout,
    shopStripeConnectReadyForCharges,
    stripePublishableKey,
    showDemoPurchaseButton,
    shopAccount,
    moderationKeywordPhrases: [] as string[],
    listings: listingRows,
    paidOrders,
    notifications: !isPlatform ? notificationsPayload : null,
    notificationsUnreadCount: !isPlatform ? notificationsUnreadCount : 0,
    initialTabDataLoaded: {
      listings: false,
      orders: false,
      notifications: false,
      support: false,
      requestListingCatalog: false,
    },
    clientTabFetch: true,
  };
}

/**
 * Loads nav badge counts only; tab bodies fetch on first open in the client.
 * Wrapped in Suspense so the shell can show {@link DashboardTabsSuspenseFallback} until both finish.
 */
async function DashboardDeferredTabsBadgeFill(props: DashboardDeferredTabsIslandProps) {
  const badgeCounts = await loadBadgeCounts(props.shopId, props.isPlatform);
  const tabProps = buildDashboardMainTabsProps(
    props,
    badgeCounts.notificationsUnread,
    badgeCounts.supportNewFromStaff,
  );
  return <DashboardMainTabs {...tabProps} />;
}

/**
 * Deferred tabs: async child resolves scoped chunks + badge counts concurrently.
 * Fallback must stay lightweight — do not mount {@link DashboardMainTabs} in the Suspense fallback.
 */
export function DashboardDeferredTabsIsland(props: DashboardDeferredTabsIslandProps) {
  return (
    <Suspense fallback={<DashboardTabsSuspenseFallback />}>
      <DashboardDeferredTabsBadgeFill {...props} />
    </Suspense>
  );
}
