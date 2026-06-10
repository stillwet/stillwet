import Link from "next/link";
import {
  GiftCreatorSuccessHomeLink,
  GiftCreatorSuccessShell,
} from "@/components/GiftCreatorSuccessShell";
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
  const sessionId = searchParams.session_id?.trim() ?? "";
  const shopSlugFromQuery = searchParams.shop?.trim() ?? "";

  if (!sessionId) {
    return (
      <GiftCreatorSuccessShell title="Gift payment">
        <p className="text-sm leading-relaxed text-zinc-400">
          Payment may have gone through, but this page is missing the Stripe session id. Open the
          success link from your browser history after checkout, or contact support with your
          receipt so we can send your gift code.
        </p>
        <Link
          href="/gift-creator"
          className="mt-8 inline-block rounded-xl border border-zinc-700 bg-zinc-900/80 px-6 py-3 text-sm font-medium text-zinc-200 hover:border-zinc-600 hover:bg-zinc-900"
        >
          Back to gift a creator
        </Link>
      </GiftCreatorSuccessShell>
    );
  }

  const result = await finalizeCreatorGiftCheckoutSessionId(sessionId);

  if (!result.ok) {
    return (
      <GiftCreatorSuccessShell title="Gift payment needs attention">
        <p className="text-sm leading-relaxed text-zinc-400">{result.error}</p>
        <Link
          href="/gift-creator"
          className="mt-8 inline-block rounded-xl border border-zinc-700 bg-zinc-900/80 px-6 py-3 text-sm font-medium text-zinc-200 hover:border-zinc-600 hover:bg-zinc-900"
        >
          Back to gift a creator
        </Link>
      </GiftCreatorSuccessShell>
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
      <GiftCreatorSuccessShell showConfetti>
        <p className="text-base font-medium text-zinc-100">
          {shopDisplayName ? (
            <>
              Credits were sent to <span className="text-zinc-50">{shopDisplayName}</span>.
            </>
          ) : (
            "Credits were sent to the shop you selected."
          )}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          The creator will see an announcement in their dashboard. Stripe will email a receipt for
          your payment.
        </p>
        <GiftCreatorSuccessHomeLink />
      </GiftCreatorSuccessShell>
    );
  }

  const purchaserEmail = result.purchaserEmail?.trim() ?? "";

  return (
    <GiftCreatorSuccessShell showConfetti>
      {result.emailSent ? (
        <>
          <p className="text-base font-medium text-zinc-100">
            {purchaserEmail ? (
              <>
                Your shop setup code was emailed to{" "}
                <span className="text-zinc-50">{purchaserEmail}</span>.
              </>
            ) : (
              "Your shop setup code was emailed to the address you entered at checkout."
            )}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Share that code with the creator when they&apos;re ready to open their shop. Check spam
            if it doesn&apos;t arrive within a few minutes. Stripe will email a receipt for your
            payment.
          </p>
        </>
      ) : result.emailPending ? (
        <>
          <p className="text-base font-medium text-zinc-100">
            Payment received, but we couldn&apos;t send the gift code email yet.
          </p>
          {result.emailError ? (
            <p className="mt-3 text-sm leading-relaxed text-amber-200/90">{result.emailError}</p>
          ) : null}
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Refresh this page in a minute, or contact support with your Stripe receipt.
          </p>
        </>
      ) : (
        <>
          <p className="text-base font-medium text-zinc-100">
            Payment received. We&apos;re preparing your shop setup code.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Refresh this page if the email doesn&apos;t arrive shortly.
          </p>
          {result.setupCode ? (
            <p className="mx-auto mt-4 max-w-xs rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 font-mono text-sm tracking-wide text-zinc-100">
              {result.setupCode}
            </p>
          ) : null}
        </>
      )}

      <GiftCreatorSuccessHomeLink />
    </GiftCreatorSuccessShell>
  );
}
