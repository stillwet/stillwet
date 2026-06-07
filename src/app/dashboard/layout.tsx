import { Suspense } from "react";
import { headers } from "next/headers";
import { PromotionsBackgroundPrefetch } from "@/components/dashboard/promotions/PromotionsBackgroundPrefetch";
import { DashboardAdminFrozenShopBanner } from "@/components/dashboard/DashboardAdminFrozenShopBanner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteHeaderFallback } from "@/components/SiteHeaderFallback";
import { shopIsAdminFrozen } from "@/lib/admin-shop-freeze";
import { isDashboardLayoutLightPath } from "@/lib/dashboard-layout-light-paths";
import { isPrismaMissingRelationError } from "@/lib/prisma-missing-relation";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSessionReadonly } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * `/dashboard` runs many Prisma calls + optional Stripe. On Vercel the default function
 * wall clock is often ~10s; without this, the RSC can be cut off while the UI stays on
 * `loading.tsx` (“stuck loading”). Vercel Pro allows up to 300s; Hobby remains ~10s.
 * @see https://vercel.com/docs/functions/limitations
 */
export const maxDuration = 300;

export default async function DashboardSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const layoutLight = isDashboardLayoutLightPath(pathname);
  const owner = await getShopOwnerSessionReadonly();
  const prefetchPromotions = Boolean(owner.shopUserId) && !layoutLight;

  let showAdminFrozenBanner = false;
  if (owner.shopUserId && !layoutLight) {
    try {
      const row = await prisma.shopUser.findUnique({
        where: { id: owner.shopUserId },
        select: { shop: { select: { adminFrozenAt: true } } },
      });
      showAdminFrozenBanner = shopIsAdminFrozen({ adminFrozenAt: row?.shop?.adminFrozenAt ?? null });
    } catch (e) {
      if (!isPrismaMissingRelationError(e)) throw e;
      console.error("[dashboard layout] adminFrozenAt read skipped — migration pending?", e);
    }
  }

  return (
    <>
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeader />
      </Suspense>
      {showAdminFrozenBanner ? <DashboardAdminFrozenShopBanner /> : null}
      {children}
      {prefetchPromotions ? <PromotionsBackgroundPrefetch /> : null}
    </>
  );
}
