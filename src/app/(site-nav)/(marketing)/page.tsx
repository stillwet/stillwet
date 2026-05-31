import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountDeletedBanner } from "@/components/AccountDeletedBanner";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";
import { BrandLogoLink } from "@/components/BrandLogoLink";
import { googleSiteVerificationMetadata } from "@/lib/google-site-verification";

export const metadata: Metadata = googleSiteVerificationMetadata;

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[996px] flex-col px-4 py-10 sm:py-14">
      <header className="text-center">
        <h1 className="m-0 flex justify-center">
          <BrandLogoLink
            className="inline-flex flex-col items-center gap-4 transition opacity-95 hover:opacity-100 sm:gap-5"
            logoHeight={52}
            showWordmark
            wordmarkClassName="store-dimension-brand text-2xl font-semibold uppercase tracking-[0.2em] text-blue-400/80 sm:text-3xl"
          />
        </h1>
        <div className="mx-auto mt-8 flex w-full max-w-2xl flex-col items-center gap-2 text-center sm:mt-10">
          <p className="m-0 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg">
            Freshly printed creator merchandise
          </p>
          <p className="m-0 max-w-2xl text-sm italic leading-relaxed text-zinc-400 sm:text-[15px]">
            We handle printing, shipping, and payments — freeing you up to focus on your designs
          </p>
        </div>
      </header>

      <Suspense fallback={null}>
        <AccountDeletedBanner />
      </Suspense>

      <section className="mx-auto mt-12 flex w-full max-w-lg flex-col items-stretch gap-3 sm:items-center">
        <p className="mb-1 text-center text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
          Start selling
        </p>
        <Link
          href="/create-shop"
          className="inline-flex w-full items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-950/30 px-5 py-2.5 text-center text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-300 shadow-sm shadow-black/10 transition hover:border-zinc-500 hover:bg-zinc-900/70 hover:text-zinc-50 sm:w-44"
        >
          Create Shop
        </Link>
        <Link
          href="/gift-creator"
          className="inline-flex w-full items-center justify-center rounded-full border border-blue-500/35 bg-blue-500/[0.06] px-5 py-2.5 text-center text-[11px] font-medium uppercase tracking-[0.22em] text-blue-100 shadow-sm shadow-black/10 transition hover:border-blue-300/70 hover:bg-blue-500/10 hover:text-white sm:w-44"
        >
          Gift a creator
        </Link>
      </section>

      <SiteLegalFooter />
    </main>
  );
}
