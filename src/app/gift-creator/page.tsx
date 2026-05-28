import Link from "next/link";
import { Suspense } from "react";
import { GiftCreatorForm } from "@/components/GiftCreatorForm";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteHeaderFallback } from "@/components/SiteHeaderFallback";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";

export default function GiftCreatorPage() {
  return (
    <>
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeader />
      </Suspense>
      <main className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-16">
        <h1 className="text-2xl font-semibold text-zinc-50">Gift a creator</h1>

        <GiftCreatorForm />

        <p className="mt-8 text-center">
          <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-400">
            ← Home
          </Link>
        </p>

        <SiteLegalFooter />
      </main>
    </>
  );
}
