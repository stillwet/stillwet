import Link from "next/link";
import { GiftCreatorSuccessHeader } from "@/components/GiftCreatorSuccessHeader";
import { finalizeCreatorGiftCheckoutSessionId } from "@/lib/creator-gift-fulfillment";
import { CreatorGiftFulfillmentMode } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = {
  mode?: string;
  shop?: string;
  session_id?: string;
};

export default async function GiftCreatorSuccessPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const searchParams = await props.searchParams;
  const mode = searchParams.mode === "direct" ? "direct" : "setup";
  const sessionId = searchParams.session_id?.trim() ?? "";
  const shopSlugFromQuery = searchParams.shop?.trim() ?? "";

  if (!sessionId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-16">
        <GiftCreatorSuccessHeader mode={mode} />
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          Payment may have gone through, but this page is missing the Stripe session id. Open the
          success link from your browser history after checkout, or contact support with your
          receipt so we can send your gift code.
        </p>
        <Link href="/" className="mt-8 text-sm text-blue-400 hover:underline">
          Return home
        </Link>
      </main>
    );
  }

  const result = await finalizeCreatorGiftCheckoutSessionId(sessionId);

  if (!result.ok) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-16">
        <h1 className="text-2xl font-semibold text-zinc-50">Gift payment needs attention</h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">{result.error}</p>
        <Link href="/gift-creator" className="mt-8 text-sm text-blue-400 hover:underline">
          Back to gift a creator
        </Link>
      </main>
    );
  }

  if (result.fulfillmentMode === CreatorGiftFulfillmentMode.direct_to_shop) {
    const shopSlug = result.shopSlug ?? shopSlugFromQuery;
    let shopDisplayName: string | null = null;
    if (shopSlug) {
      const shop = await prisma.shop.findUnique({
        where: { slug: shopSlug },
        select: { displayName: true },
      });
      shopDisplayName = shop?.displayName ?? shopSlug;
    }

    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-16">
        <GiftCreatorSuccessHeader mode="direct" />
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          Payment received
          {shopDisplayName ? (
            <>
              {" "}
              — credits were sent to <span className="text-zinc-200">{shopDisplayName}</span>.
            </>
          ) : (
            " — credits were sent to the shop you selected."
          )}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          The creator will see an announcement in their dashboard.
        </p>
        <Link href="/" className="mt-8 text-sm text-blue-400 hover:underline">
          Return home
        </Link>
      </main>
    );
  }

  const purchaserEmail = result.purchaserEmail?.trim() ?? "";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-16">
      <GiftCreatorSuccessHeader mode="setup" />

      {result.emailSent ? (
        <>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            Payment received
            {purchaserEmail ? (
              <>
                . Your shop setup code was emailed to{" "}
                <span className="text-zinc-200">{purchaserEmail}</span>.
              </>
            ) : (
              ". Your shop setup code was emailed to the address you entered at checkout."
            )}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            Share that code with the creator when they&apos;re ready to open their shop. Check spam
            if it doesn&apos;t arrive within a few minutes.
          </p>
        </>
      ) : result.emailPending ? (
        <>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            Payment received, but we couldn&apos;t send the gift code email yet.
          </p>
          {result.emailError ? (
            <p className="mt-3 text-sm leading-relaxed text-amber-200/90">{result.emailError}</p>
          ) : null}
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            Refresh this page in a minute, or contact support with your Stripe receipt.
          </p>
        </>
      ) : (
        <>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            Payment received. We&apos;re preparing your shop setup code — refresh this page if the
            email doesn&apos;t arrive shortly.
          </p>
          {result.setupCode ? (
            <p className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 font-mono text-sm tracking-wide text-zinc-100">
              {result.setupCode}
            </p>
          ) : null}
        </>
      )}

      <Link href="/" className="mt-8 text-sm text-blue-400 hover:underline">
        Return home
      </Link>
    </main>
  );
}
