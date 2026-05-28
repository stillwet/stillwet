import Link from "next/link";
import { redirect } from "next/navigation";
import { finalizeShopSetupFeeCheckoutSessionId } from "@/lib/shop-setup-fee-fulfillment";
import { getShopOwnerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ session_id?: string }> };

export default async function ShopSetupSuccessPage({ searchParams }: Props) {
  const { session_id } = await searchParams;
  if (!session_id) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-16">
        <h1 className="text-2xl font-semibold text-zinc-50">Setup payment missing</h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          We could not find the Stripe checkout session for this setup payment.
        </p>
        <Link href="/create-shop" className="mt-8 text-sm text-blue-400 hover:underline">
          Return to shop setup
        </Link>
      </main>
    );
  }

  const result = await finalizeShopSetupFeeCheckoutSessionId(session_id);
  if (result.ok) {
    const session = await getShopOwnerSession();
    session.shopUserId = result.shopUserId;
    await session.save();
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-50">Setup payment needs attention</h1>
      <p className="mt-4 text-sm leading-relaxed text-zinc-400">{result.error}</p>
      <Link href="/create-shop" className="mt-8 text-sm text-blue-400 hover:underline">
        Return to shop setup
      </Link>
    </main>
  );
}
