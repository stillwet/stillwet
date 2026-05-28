import Link from "next/link";
import { redirect } from "next/navigation";
import { finalizeShopReactivationCheckoutSessionId } from "@/lib/shop-reactivation-fulfillment";
import { getShopOwnerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ session_id?: string }> };

export default async function ShopReactivationSuccessPage({ searchParams }: Props) {
  const { session_id } = await searchParams;
  if (!session_id) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-16">
        <h1 className="text-2xl font-semibold text-zinc-50">Reactivation payment missing</h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          We could not find the Stripe checkout session for this reactivation payment.
        </p>
        <Link href="/dashboard/login" className="mt-8 text-sm text-blue-400 hover:underline">
          Return to login
        </Link>
      </main>
    );
  }

  const result = await finalizeShopReactivationCheckoutSessionId(session_id);
  if (result.ok) {
    const session = await getShopOwnerSession();
    session.shopUserId = result.shopUserId;
    await session.save();
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-16">
      <h1 className="text-2xl font-semibold text-zinc-50">Reactivation needs attention</h1>
      <p className="mt-4 text-sm leading-relaxed text-zinc-400">{result.error}</p>
      <Link href="/dashboard/login" className="mt-8 text-sm text-blue-400 hover:underline">
        Return to login
      </Link>
    </main>
  );
}
