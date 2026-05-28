import Link from "next/link";
import { clearCartAfterPaidSession } from "@/actions/order";
import { SHOP_ALL_ROUTE } from "@/lib/constants";
import { StoreDocumentPanel } from "@/components/StoreDocumentPanel";
import { SuccessCartClear } from "@/components/SuccessCartClear";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ session_id?: string }> };

export default async function OrderSuccessPage({ searchParams }: Props) {
  const { session_id } = await searchParams;
  if (session_id) {
    await clearCartAfterPaidSession(session_id);
  }

  return (
    <StoreDocumentPanel backHref={SHOP_ALL_ROUTE} backLabel="Continue shopping" title="Thank you">
      {session_id ? <SuccessCartClear sessionId={session_id} /> : null}
      <div className="text-center">
        <p className="text-sm leading-relaxed text-zinc-400">
          Your payment was received. You will get an email confirmation from Stripe.
        </p>
        <Link
          href={SHOP_ALL_ROUTE}
          className="mt-8 inline-block rounded-xl bg-blue-900/90 px-6 py-3 text-sm font-medium text-white hover:bg-blue-800"
        >
          Continue shopping
        </Link>
      </div>
    </StoreDocumentPanel>
  );
}
