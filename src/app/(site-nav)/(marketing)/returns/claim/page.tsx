import Link from "next/link";
import { loadOrderReturnClaimCatalogOptions } from "@/actions/order-return-claim";
import { OrderReturnClaimForm } from "@/components/OrderReturnClaimForm";
import { isR2UploadConfigured } from "@/lib/r2-upload";

export const metadata = {
  title: "Item claim",
};

export default async function OrderReturnClaimPage() {
  const [catalogOptions, r2Configured] = await Promise.all([
    loadOrderReturnClaimCatalogOptions(),
    Promise.resolve(isR2UploadConfigured()),
  ]);

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-xl font-semibold text-zinc-50">Item claim</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Submit one item at a time. Claims must include photo evidence and fall within{" "}
        <Link href="/returns" className="text-blue-400/90 underline underline-offset-2 hover:text-blue-300">
          return policy
        </Link>
        .
      </p>
      <div className="mt-8">
        <OrderReturnClaimForm catalogOptions={catalogOptions} r2Configured={r2Configured} />
      </div>
      <p className="mt-8 text-center">
        <Link href="/returns" className="text-xs text-blue-400/90 hover:underline">
          Return &amp; refund policy
        </Link>
      </p>
    </main>
  );
}
