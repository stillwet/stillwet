import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteHeaderFallback } from "@/components/SiteHeaderFallback";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";
import { GiftCreatorStorefrontLink } from "@/components/GiftCreatorStorefrontLink";

/** Tenant shop shell loads listings browse data + header — avoid Vercel default ~10s cutoff. */
export const maxDuration = 300;

const cachedActiveShopExists = (shopSlug: string) =>
  unstable_cache(
    () =>
      prisma.shop.findFirst({
        where: { slug: shopSlug, active: true },
        select: { id: true },
      }),
    ["active-shop-exists", shopSlug],
    { revalidate: 10 * 60 },
  )();

export default async function ShopTenantLayout({
  children,
  modal,
  params,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  const shop = await cachedActiveShopExists(shopSlug);
  if (!shop) notFound();

  return (
    <div className="store-dimension-bg">
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeader shopSlug={shopSlug} />
      </Suspense>
      <GiftCreatorStorefrontLink />
      <div className="mx-auto max-w-[1124px] px-4 py-8 sm:px-6 sm:py-10">{children}</div>
      <div className="mx-auto max-w-[1124px] px-4 pb-10 sm:px-6">
        <SiteLegalFooter />
      </div>
      {modal}
    </div>
  );
}
