import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getAdminSessionReadonly,
  getShopOwnerSession,
  getShopOwnerSessionReadonly,
} from "@/lib/session";
import { ListingRequestStatus } from "@/generated/prisma/enums";
import {
  countListingRowsInReview,
  LISTING_REQUEST_IN_REVIEW_STATUSES,
} from "@/lib/listing-request-review-limit";
import {
  PLATFORM_SHOP_SLUG,
  nextListingRequestRequiresCredit,
} from "@/lib/marketplace-constants";
import { syncFreeListingFeeWaivers } from "@/lib/listing-fee";
import { getStripe, isStripeSecretConfigured } from "@/lib/stripe";
import { dashboardTryCompleteAccountDeletion } from "@/actions/dashboard-account-danger";
import { logoutShopOwner } from "@/actions/shop-auth";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";
import {
  DashboardDeferredTabsIsland,
  type CreatorDashboardSetupPayload,
} from "@/components/dashboard/DashboardDeferredTabsIsland";
import { ListingSubmittedFlashBanner } from "@/components/dashboard/ListingSubmittedFlashBanner";
import { ShopSignupWelcomeConfetti } from "@/components/dashboard/ShopSignupWelcomeConfetti";
import { StripeOnboardingCompleteCelebration } from "@/components/dashboard/StripeOnboardingCompleteCelebration";
import { DashboardTabsSuspenseFallback } from "./DashboardPageSuspenseFallback";
import { DASHBOARD_MAIN_SHELL_CLASS } from "@/lib/dashboard-layout";
import { scopesForInitialTab } from "@/lib/dashboard-scoped-data";
import {
  computeShopOnboardingSteps,
  countIncompleteOnboardingSteps,
} from "@/lib/shop-onboarding-gate";
import { connectBalanceBlocksDeletion, getStripeConnectBalanceUsdCents } from "@/lib/stripe-connect-balance";
import {
  stripeConnectActivationHint,
  stripeConnectFlagsFromAccount,
} from "@/lib/stripe-connect-account-status";
import { shopStripeConnectReadyForListingCharges } from "@/lib/shop-stripe-connect-gate";
import { shopDisplayNameForPublicLabel } from "@/lib/shop-display-name-uniqueness";
import { ShopDataLoadError } from "@/components/ShopDataLoadError";
import {
  requireShopDashboardUserWithShop,
  signOutShopOwnerAndRedirectHome,
  tryRedirectHomeOnDeletedShopAccountLoadError,
} from "@/lib/shop-account-deleted-session";
import {
  dashQueryParamForTabId,
  dashboardTabParamToId,
  isLegacyDashboardPromotionsDashParam,
} from "@/lib/dashboard-dash-query";
import { dashboardPromotionsUrl } from "@/lib/dashboard-promotions-path";
import { loadShopFlairDashboardPayload } from "@/lib/shop-flair-dashboard-payload";
import { DashboardShopPageActions } from "@/components/dashboard/DashboardShopPageActions";
import { ShopDashboardCompactLayoutProvider } from "@/components/dashboard/shop-dashboard-compact-layout";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const DASHBOARD_CONNECT_QUERY_KEYS = ["connect", "reason"] as const;

/** Serialize current dashboard query for tab `Link` hrefs; `dash` is set per tab on the client. */
function dashboardSearchParamsPreserveDash(
  sp: Record<string, string | string[] | undefined>,
): string {
  const p = new URLSearchParams();
  for (const [key, raw] of Object.entries(sp)) {
    if (key === "dash") continue;
    if (raw === undefined) continue;
    const values = Array.isArray(raw) ? raw : [raw];
    for (const v of values) {
      if (typeof v === "string" && v.length > 0) p.append(key, v);
    }
  }
  return p.toString();
}

/** Drop Stripe Connect callback/error params (stale after Connect succeeds). */
function dashboardSearchParamsWithoutConnectQuery(
  sp: Record<string, string | string[] | undefined>,
): string {
  const p = new URLSearchParams();
  for (const [key, raw] of Object.entries(sp)) {
    if ((DASHBOARD_CONNECT_QUERY_KEYS as readonly string[]).includes(key)) continue;
    if (raw === undefined) continue;
    const values = Array.isArray(raw) ? raw : [raw];
    for (const v of values) {
      if (typeof v === "string" && v.length > 0) p.append(key, v);
    }
  }
  return p.toString();
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const [owner, adminSession] = await Promise.all([
    getShopOwnerSessionReadonly(),
    getAdminSessionReadonly(),
  ]);
  if (!owner.shopUserId) redirect("/dashboard/login");

  const sp = await searchParams;
  const connect = typeof sp.connect === "string" ? sp.connect : undefined;
  const onboardingCompleteFlash = sp.onboardingComplete === "1";
  const connectReason =
    typeof sp.reason === "string" ? sp.reason : Array.isArray(sp.reason) ? sp.reason[0] : undefined;
  const fee = typeof sp.fee === "string" ? sp.fee : undefined;
  const promo = typeof sp.promo === "string" ? sp.promo : undefined;
  const promoErr =
    typeof sp.promoErr === "string"
      ? sp.promoErr
      : Array.isArray(sp.promoErr)
        ? sp.promoErr[0]
        : undefined;
  const dashRaw = sp.dash;
  const dashRawStr =
    typeof dashRaw === "string" ? dashRaw : Array.isArray(dashRaw) ? dashRaw[0] : undefined;
  const dashStr = dashboardTabParamToId(dashRawStr);
  const delConfirmRaw = sp.delConfirm;
  const delConfirm =
    typeof delConfirmRaw === "string"
      ? delConfirmRaw
      : Array.isArray(delConfirmRaw)
        ? delConfirmRaw[0]
        : undefined;

  try {
  const MINIMAL_LISTING_SELECT = {
    id: true,
    active: true,
    requestStatus: true,
    creatorRemovedFromShopAt: true,
    adminRemovedFromShopAt: true,
    createdAt: true,
  } as const;

  /** Initial dashboard read — only columns the page and tab shell need (smaller row than `include: { shop: true }`). */
  const DASHBOARD_SHOP_SELECT = {
    id: true,
    slug: true,
    displayName: true,
    listedOnShopsBrowse: true,
    profileImageUrl: true,
    welcomeMessage: true,
    socialLinks: true,
    stripeConnectAccountId: true,
    connectChargesEnabled: true,
    payoutsEnabled: true,
    itemGuidelinesAcknowledgedAt: true,
    accountDeletionRequestedAt: true,
    accountDeletionEmailConfirmedAt: true,
    inactivityDeactivatedAt: true,
    listingFeeBonusFreeSlots: true,
  } as const;

  const user = await requireShopDashboardUserWithShop(
    await prisma.shopUser.findUnique({
      where: { id: owner.shopUserId },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        twoFactorEmailEnabled: true,
        shop: { select: DASHBOARD_SHOP_SELECT },
      },
    }),
  );

  let shop = user.shop;
  const isPlatform = shop.slug === PLATFORM_SHOP_SLUG;
  if (!isPlatform && shop.inactivityDeactivatedAt) {
    const session = await getShopOwnerSession();
    session.destroy();
    redirect("/dashboard/login?reactivate=required");
  }

  if (!isPlatform && isLegacyDashboardPromotionsDashParam(dashRawStr)) {
    redirect(
      dashboardPromotionsUrl({
        promo: typeof promo === "string" ? promo : undefined,
        promoErr: typeof promoErr === "string" ? promoErr : undefined,
      }),
    );
  }
  const listingsMinimalInclude = {
    orderBy: { updatedAt: "desc" as const },
    select: MINIMAL_LISTING_SELECT,
  };

  let stripeConnectPendingHint: string | null = null;
  const shouldRefreshStripeConnect =
    !isPlatform &&
    shop.stripeConnectAccountId &&
    isStripeSecretConfigured() &&
    (connect === "return" ||
      connect === "refresh" ||
      !shop.connectChargesEnabled ||
      !shop.payoutsEnabled);

  if (shouldRefreshStripeConnect && shop.stripeConnectAccountId) {
    try {
      const stripe = getStripe();
      const acct = await stripe.accounts.retrieve(shop.stripeConnectAccountId);
      const flags = stripeConnectFlagsFromAccount(acct);
      await prisma.shop.update({
        where: { id: shop.id },
        data: flags,
      });
      stripeConnectPendingHint = stripeConnectActivationHint(acct);
      if (connect === "return" || connect === "refresh") {
        shop = await prisma.shop.findUniqueOrThrow({
          where: { id: shop.id },
          include: { listings: listingsMinimalInclude },
        });
      } else {
        shop = await prisma.shop.findUniqueOrThrow({
          where: { id: shop.id },
          select: DASHBOARD_SHOP_SELECT,
        });
      }
    } catch (e) {
      console.error("[dashboard] Stripe Connect status sync failed", e);
    }
  }

  /** When `shop` was loaded with `include: listings` (Connect return path). Otherwise use probes below. */
  const shopIncludesListings = "listings" in shop && Array.isArray((shop as { listings?: unknown }).listings);

  let submittedRequestCount: number;
  let inReviewListingRequestCount: number;
  let setupSteps: ReturnType<typeof computeShopOnboardingSteps>;

  if (!isPlatform) {
    if (shopIncludesListings) {
      const rows = (
        shop as unknown as {
          listings: Array<{ requestStatus: ListingRequestStatus; active: boolean }>;
        }
      ).listings;
      submittedRequestCount = rows.filter((l) => l.requestStatus !== ListingRequestStatus.draft).length;
      inReviewListingRequestCount = countListingRowsInReview(rows);
      setupSteps = computeShopOnboardingSteps({
        displayName: shop.displayName,
        itemGuidelinesAcknowledgedAt: shop.itemGuidelinesAcknowledgedAt,
        emailVerifiedAt: user.emailVerifiedAt,
        listings: rows.map((l) => ({
          requestStatus: l.requestStatus,
          active: l.active,
        })),
        connectChargesEnabled: shop.connectChargesEnabled,
        payoutsEnabled: shop.payoutsEnabled,
      });
    } else {
      const [listingProgressHit, nonDraftCount, inReviewCount] = await Promise.all([
        prisma.shopListing.findFirst({
          where: {
            shopId: shop.id,
            OR: [
              { requestStatus: ListingRequestStatus.submitted },
              { requestStatus: ListingRequestStatus.images_ok },
              { requestStatus: ListingRequestStatus.printify_item_created },
              { requestStatus: ListingRequestStatus.approved },
              { active: true },
            ],
          },
          select: { id: true },
        }),
        prisma.shopListing.count({
          where: {
            shopId: shop.id,
            requestStatus: { not: ListingRequestStatus.draft },
          },
        }),
        prisma.shopListing.count({
          where: {
            shopId: shop.id,
            requestStatus: { in: [...LISTING_REQUEST_IN_REVIEW_STATUSES] },
          },
        }),
      ]);
      submittedRequestCount = nonDraftCount;
      inReviewListingRequestCount = inReviewCount;
      setupSteps = computeShopOnboardingSteps({
        displayName: shop.displayName,
        itemGuidelinesAcknowledgedAt: shop.itemGuidelinesAcknowledgedAt,
        emailVerifiedAt: user.emailVerifiedAt,
        hasListingProgress: listingProgressHit != null,
        connectChargesEnabled: shop.connectChargesEnabled,
        payoutsEnabled: shop.payoutsEnabled,
      });
    }
  } else {
    submittedRequestCount = 0;
    inReviewListingRequestCount = 0;
    setupSteps = {
      profile: true,
      guidelines: true,
      emailVerified: true,
      listing: true,
      stripe: true,
    };
  }

  const incompleteSetupCount = !isPlatform ? countIncompleteOnboardingSteps(setupSteps) : 0;

  if (
    !isPlatform &&
    setupSteps.stripe &&
    connect &&
    (connect === "return" ||
      connect === "refresh" ||
      (connect === "err" && connectReason === "stripe_link"))
  ) {
    const p = new URLSearchParams(dashboardSearchParamsWithoutConnectQuery(sp));
    if (connect === "return" && incompleteSetupCount === 0) {
      p.set("onboardingComplete", "1");
    }
    const qs = p.toString();
    redirect(qs ? `/dashboard?${qs}` : "/dashboard");
  }

  const dashTab:
    | "setup"
    | "shopProfile"
    | "itemGuidelines"
    | "requestListing"
    | "bugFeedback"
    | "listings"
    | "notifications"
    | "support"
    | "orders"
    | "accountInfo" = isPlatform
    ? dashStr === "orders"
      ? "orders"
      : "listings"
    : dashStr === "listings" ||
        dashStr === "orders" ||
        dashStr === "setup" ||
        dashStr === "shopProfile" ||
        dashStr === "itemGuidelines" ||
        dashStr === "notifications" ||
        dashStr === "requestListing" ||
        dashStr === "bugFeedback" ||
        dashStr === "accountInfo" ||
        dashStr === "support"
      ? dashStr === "setup" && incompleteSetupCount === 0
        ? "listings"
        : dashStr === "itemGuidelines" && incompleteSetupCount === 0
          ? "listings"
          : dashStr === "itemGuidelines" && shop.itemGuidelinesAcknowledgedAt != null
            ? "setup"
            : dashStr
      : incompleteSetupCount > 0
        ? "setup"
        : "listings";

  const scopes = scopesForInitialTab(dashTab, isPlatform);

  if (
    !isPlatform &&
    (scopes.includes("listingsBody") || scopes.includes("requestListingCatalog"))
  ) {
    await syncFreeListingFeeWaivers(shop.id);
    shop = await prisma.shop.findUniqueOrThrow({
      where: { id: shop.id },
      include: { listings: listingsMinimalInclude },
    });
    submittedRequestCount = await prisma.shopListing.count({
      where: {
        shopId: shop.id,
        requestStatus: { not: ListingRequestStatus.draft },
      },
    });
    inReviewListingRequestCount = await prisma.shopListing.count({
      where: {
        shopId: shop.id,
        requestStatus: { in: [...LISTING_REQUEST_IN_REVIEW_STATUSES] },
      },
    });
  }

  const stripeConnectBalance =
    !isPlatform && shop.accountDeletionEmailConfirmedAt != null
      ? await getStripeConnectBalanceUsdCents(shop.stripeConnectAccountId)
      : null;

  if (
    !isPlatform &&
    shop.accountDeletionRequestedAt != null &&
    shop.accountDeletionEmailConfirmedAt != null &&
    !connectBalanceBlocksDeletion(stripeConnectBalance)
  ) {
    const r = await dashboardTryCompleteAccountDeletion();
    if (r.ok) {
      await signOutShopOwnerAndRedirectHome();
    }
  }

  const shopStripeConnectReadyForCharges = shopStripeConnectReadyForListingCharges(shop);
  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || null;
  const bonusListingSlots = shop.listingFeeBonusFreeSlots ?? 0;
  const needsListingCreditForNextRequest = nextListingRequestRequiresCredit(
    shop.slug,
    bonusListingSlots,
    submittedRequestCount,
  );

  const setupTabsKey = `setup-${setupSteps.stripe}-${setupSteps.profile}-${setupSteps.guidelines}-${setupSteps.emailVerified}-${setupSteps.listing}-${Boolean(shop.itemGuidelinesAcknowledgedAt)}-${Boolean(user.emailVerifiedAt)}`;

  const flairPayload = !isPlatform ? await loadShopFlairDashboardPayload(shop.id) : null;

  const creatorSetup: CreatorDashboardSetupPayload | null = !isPlatform
    ? {
        setupTabsKey,
        incompleteSetupCount,
        onboardingCompleteFlash,
        steps: setupSteps,
        shopPanel: {
          shopSlug: shop.slug,
          displayName: shop.displayName,
          listedOnShopsBrowse: shop.listedOnShopsBrowse,
          profileImageUrl: shop.profileImageUrl,
          welcomeMessage: shop.welcomeMessage,
          socialLinks: shop.socialLinks,
          stripeConnectAccountId: shop.stripeConnectAccountId,
          connectChargesEnabled: shop.connectChargesEnabled,
          payoutsEnabled: shop.payoutsEnabled,
          accountDeletionRequestedAt: shop.accountDeletionRequestedAt?.toISOString() ?? null,
          accountDeletionEmailConfirmedAt:
            shop.accountDeletionEmailConfirmedAt?.toISOString() ?? null,
          stripeConnectBalance,
          stripeConnectPendingHint,
          flair: flairPayload ?? undefined,
        },
        itemGuidelinesAcknowledged: shop.itemGuidelinesAcknowledgedAt != null,
        needsListingCreditForNextRequest,
        inReviewListingRequestCount,
        stripeConnectReadyForPaidListings: shopStripeConnectReadyForCharges,
      }
    : null;

  const dashboardQueryPreserve = dashboardSearchParamsPreserveDash(sp);
  const bugFeedbackHref = (() => {
    const p = new URLSearchParams(dashboardQueryPreserve);
    p.set("dash", dashQueryParamForTabId("bugFeedback"));
    const q = p.toString();
    const dashVal = dashQueryParamForTabId("bugFeedback");
    return q ? `/dashboard?${q}` : `/dashboard?dash=${dashVal}`;
  })();

  return (
    <ShopDashboardCompactLayoutProvider>
    <main className={DASHBOARD_MAIN_SHELL_CLASS}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-zinc-50">Shop Dashboard</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm text-zinc-500">{shopDisplayNameForPublicLabel(shop.displayName)}</p>
            <form
              action={logoutShopOwner}
              className="border-l border-zinc-700 pl-3 leading-none"
            >
              <button
                type="submit"
                className="text-sm text-zinc-500 transition hover:text-zinc-300"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <DashboardShopPageActions
          shopSlug={shop.slug}
          bugFeedbackHref={!isPlatform ? bugFeedbackHref : undefined}
          bugFeedbackActive={!isPlatform && dashTab === "bugFeedback"}
        />
      </div>

      <Suspense fallback={null}>
        <ShopSignupWelcomeConfetti />
        <StripeOnboardingCompleteCelebration />
        <ListingSubmittedFlashBanner />
      </Suspense>
      {fee === "ok" ? (
        <p className="mt-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90">
          Listing fee payment received (or mock checkout). You can continue with your listing workflow.
        </p>
      ) : null}
      {fee === "cancel" ? (
        <p className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200/90">
          Listing fee checkout was cancelled.
        </p>
      ) : null}
      {fee === "err" ? (
        <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-200/90">
          {connectReason === "listing_credits_required"
            ? "Buy listing credits on the Request listing tab before publishing more listings."
            : connectReason === "no_app_url"
              ? "Listing fee payment could not start because the app base URL is not configured on the server."
              : connectReason === "stripe"
                ? "Stripe returned an error while starting listing fee checkout. Try again or contact support."
                : "Something went wrong with the listing fee payment. Open the Listings tab and try paying again, or contact support."}
        </p>
      ) : null}
      {!isPlatform && delConfirm === "ok" ? (
        <p className="mt-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-zinc-50">
          Account deletion email confirmed. Your login email has been removed so you can sign up fresh. Any remaining
          shop record is removed automatically once Stripe Connect balance is zero.
        </p>
      ) : null}
      {!isPlatform && delConfirm === "purgeFailed" ? (
        <p className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-zinc-50">
          Your deletion email was confirmed, but we could not finish clearing your stored images from our servers. Try the
          link again from email, reload this page later, or contact support.
        </p>
      ) : null}
      {!isPlatform && delConfirm && delConfirm !== "ok" && delConfirm !== "purgeFailed" ? (
        <p className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-zinc-50">
          {delConfirm === "expired"
            ? "That account deletion link has expired. Request deletion again from the Shop profile tab to receive a new email."
            : delConfirm === "missing"
              ? "That account deletion link was missing a token. Open the full link from your latest email, or request deletion again."
              : "That account deletion link is invalid. Request a new one from the Shop profile tab if you still want to delete your account."}
        </p>
      ) : null}
      {!isPlatform && !setupSteps.stripe && connect === "err" && connectReason === "stripe_link" ? (
        <p className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200/90">
          Could not open Stripe onboarding. Try again in a moment, or check Vercel logs for{" "}
          <code className="text-amber-100/80">dashboardStartStripeConnect</code>.
        </p>
      ) : null}

      {isPlatform ? (
        <p className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-sm text-zinc-500">
          You are signed in as the platform catalog shop owner. Marketplace Connect and per-listing fees do
          not apply to this account. Paid listing promotions
          are only available on creator shop accounts (your own storefront slug), not on this catalog
          account.
        </p>
      ) : null}

      <Suspense fallback={<DashboardTabsSuspenseFallback />}>
        <DashboardDeferredTabsIsland
          shopId={shop.id}
          shopSlug={shop.slug}
          isPlatform={isPlatform}
          adminLoggedIn={adminSession.isAdmin === true}
          scopes={scopes}
          dashTab={dashTab}
          dashboardQueryPreserve={dashboardQueryPreserve}
          listingFeeBonusFreeSlots={bonusListingSlots}
          stripePublishableKey={stripePublishableKey}
          shopStripeConnectReadyForCharges={shopStripeConnectReadyForCharges}
          creatorSetup={creatorSetup}
          shopAccount={
            !isPlatform
              ? {
                  email: user.email,
                  emailVerified: user.emailVerifiedAt != null,
                  twoFactorEmailEnabled: user.twoFactorEmailEnabled,
                  accountDeletionRequestedAt: shop.accountDeletionRequestedAt?.toISOString() ?? null,
                  accountDeletionEmailConfirmedAt:
                    shop.accountDeletionEmailConfirmedAt?.toISOString() ?? null,
                  stripeConnectAccountId: shop.stripeConnectAccountId,
                  stripeConnectBalance,
                }
              : null
          }
        />
      </Suspense>

      <SiteLegalFooter />
    </main>
    </ShopDashboardCompactLayoutProvider>
  );
  } catch (e) {
    await tryRedirectHomeOnDeletedShopAccountLoadError(e, owner.shopUserId);
    return <ShopDataLoadError cause={e} />;
  }
}
