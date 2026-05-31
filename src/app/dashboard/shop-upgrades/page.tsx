import Link from "next/link";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

import { getShopOwnerSessionReadonly } from "@/lib/session";

import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";

import { isMockCheckoutEnabled, promotionUiUsesMockCheckout } from "@/lib/checkout-mock";
import { loadShopFlairDashboardPayload } from "@/lib/shop-flair-dashboard-payload";
import { loadShopGoogleShoppingDashboardPayload } from "@/lib/shop-google-shopping-dashboard-payload";

import { PromotionsCheckoutShell } from "@/components/dashboard/PromotionsCheckoutShell";

import { PromotionsPickerShell } from "@/components/dashboard/PromotionsPickerShell";

import { PromotionsSectionFrame } from "@/components/dashboard/PromotionsSectionFrame";

import { PromotionsHistoryCollapsed } from "@/components/dashboard/promotions/PromotionsHistoryCollapsed";
import { PromotionsHistoryExpanded } from "@/components/dashboard/promotions/PromotionsHistoryExpanded";
import { PromotionsPagePeriodPrefetch } from "@/components/dashboard/promotions/PromotionsPagePeriodPrefetch";
import { ShopFlairSection } from "@/components/dashboard/ShopFlairSection";
import { ShopGoogleShoppingSection } from "@/components/dashboard/ShopGoogleShoppingSection";

import { parsePlacementCheckoutBuyKind } from "@/lib/promotion-kind-load-order";

import { promotionPeriodChoicesAtClick } from "@/lib/promotion-period-choices-at-click";
import {
  parsePlacementPeriodOffset,
  resolvePlacementPeriodOffsetFromChoices,
} from "@/lib/promotions-page-query";

import { SiteLegalFooter } from "@/components/SiteLegalFooter";
import { ShopDataLoadError } from "@/components/ShopDataLoadError";

import { rethrowNextNavigationError } from "@/lib/next-navigation-errors";
import { DASHBOARD_SHOP_UPGRADES_LABEL } from "@/lib/dashboard-promotions-path";

export const dynamic = "force-dynamic";

export const metadata = {
  title: DASHBOARD_SHOP_UPGRADES_LABEL,
};



type PageProps = {

  searchParams: Promise<Record<string, string | string[] | undefined>>;

};



function firstQueryString(

  raw: string | string[] | undefined,

): string | undefined {

  if (typeof raw === "string") return raw;

  if (Array.isArray(raw)) return raw[0];

  return undefined;

}



function promotionsQueryPreserve(sp: {

  promo?: string;

  promoErr?: string;

  history?: string;

  buy?: string;

  period?: string;

}): Record<string, string | undefined> {

  const q: Record<string, string | undefined> = {};

  if (sp.promo) q.promo = sp.promo;

  if (sp.promoErr) q.promoErr = sp.promoErr;

  if (sp.history === "1") q.history = "1";

  if (sp.buy) q.buy = sp.buy;

  if (sp.period != null && sp.period !== "") q.period = sp.period;

  return q;

}



export default async function DashboardShopUpgradesPage({ searchParams }: PageProps) {

  const owner = await getShopOwnerSessionReadonly();

  if (!owner.shopUserId) redirect("/dashboard/login");



  const sp = await searchParams;

  const promo = firstQueryString(sp.promo);

  const promoErr = firstQueryString(sp.promoErr);

  const buyKind = parsePlacementCheckoutBuyKind(firstQueryString(sp.buy));

  const showHistory = firstQueryString(sp.history) === "1";

  const periodRaw = firstQueryString(sp.period);

  const queryPreserve = promotionsQueryPreserve({

    promo,

    promoErr,

    history: showHistory ? "1" : undefined,

    buy: buyKind ?? undefined,

    period: buyKind != null ? periodRaw : undefined,

  });



  try {

    const user = await prisma.shopUser.findUnique({

      where: { id: owner.shopUserId },

      select: {

        shop: {

          select: {

            id: true,

            slug: true,

            displayName: true,

            inactivityDeactivatedAt: true,

          },

        },

      },

    });

    if (!user) redirect("/dashboard/login");



    const shop = user.shop;

    if (shop.slug === PLATFORM_SHOP_SLUG) {

      redirect("/dashboard");

    }

    if (shop.inactivityDeactivatedAt) {

      redirect("/dashboard/login?reactivate=required");

    }



    const [flair, googleShopping, mockPromotionCheckout] = await Promise.all([
      loadShopFlairDashboardPayload(shop.id),
      loadShopGoogleShoppingDashboardPayload(shop.id),
      Promise.resolve(promotionUiUsesMockCheckout(shop.slug)),
    ]);
    const mockListingFeeCheckout = isMockCheckoutEnabled();
    const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || null;

    const buyPeriodOffset = buyKind != null ? parsePlacementPeriodOffset(periodRaw) : null;
    const computedPeriodChoices =
      buyKind != null && buyPeriodOffset != null ? promotionPeriodChoicesAtClick(buyKind) : null;
    const resolvedPeriodOffset =
      computedPeriodChoices != null && buyPeriodOffset != null
        ? resolvePlacementPeriodOffsetFromChoices(computedPeriodChoices, buyPeriodOffset)
        : null;



    return (

      <main className="mx-auto flex min-h-screen max-w-[868px] flex-col px-4 py-12">
        <PromotionsPagePeriodPrefetch enabled={buyKind != null} />

        <Link href="/dashboard" prefetch={false} className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Shop dashboard
        </Link>

        <div className="mt-3">
          <h1 className="text-2xl font-semibold text-zinc-50">{DASHBOARD_SHOP_UPGRADES_LABEL}</h1>
          <p className="mt-1 text-sm text-zinc-500">{shop.displayName}</p>
        </div>



        {promo === "ok" ? (

          <p className="mt-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90">

            Purchase recorded (mock checkout when enabled).

          </p>

        ) : null}

        {promo === "cancel" ? (

          <p className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200/90">

            Checkout was cancelled.

          </p>

        ) : null}

        {promo === "err" ? (

          <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-200/90">

            {promoErr === "mock_only"

              ? "Mock placement pay is only available when mock checkout is enabled on the server."

              : promoErr === "hot_item_policy"

                ? "That promotion could not be recorded (Hot item / Top shop periods may be fully booked). Refresh and try again, or contact support."

                : "Something went wrong recording your purchase. Try again or contact support."}

          </p>

        ) : null}


        {!flair.purchasedAt ? (
          <ShopFlairSection
            flair={flair}
            stripePublishableKey={stripePublishableKey}
            mockListingFeeCheckout={mockListingFeeCheckout}
            className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/50 p-2 sm:p-3"
          />
        ) : null}

        <ShopGoogleShoppingSection
          googleShopping={googleShopping}
          stripePublishableKey={stripePublishableKey}
          mockListingFeeCheckout={mockListingFeeCheckout}
          className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/50 p-2 sm:p-3"
        />

        <PromotionsSectionFrame>
          <PromotionsPickerShell
            selectedKind={buyKind}
            queryPreserve={queryPreserve}
            activeCheckout={
              buyKind != null ? (
                <PromotionsCheckoutShell
                  kind={buyKind}
                  selectedOffset={resolvedPeriodOffset}
                  computedPeriodChoices={computedPeriodChoices}
                  mockPromotionCheckout={mockPromotionCheckout}
                  stripePublishableKey={stripePublishableKey ?? ""}
                  queryPreserve={queryPreserve}
                />
              ) : null
            }
          />

          {showHistory ? (
            <PromotionsHistoryExpanded />
          ) : (
            <PromotionsHistoryCollapsed queryPreserve={queryPreserve} />
          )}

        </PromotionsSectionFrame>

        <SiteLegalFooter />
      </main>

    );

  } catch (e) {

    rethrowNextNavigationError(e);

    return <ShopDataLoadError cause={e} />;

  }

}

