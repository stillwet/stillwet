import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/SiteHeader";
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

function SiteHeaderFallback() {
  return (
    <header className="relative z-[1000] border-b border-zinc-800/40 bg-zinc-950/40 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1124px] items-center justify-between gap-4 px-4 py-4">
        <div className="h-7 w-28 animate-pulse rounded bg-zinc-800/80" />
        <div className="flex flex-1 justify-end gap-6">
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-800/80" />
          <div className="h-4 w-16 animate-pulse rounded bg-zinc-800/80" />
        </div>
      </div>
    </header>
  );
}

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
