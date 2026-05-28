import Link from "next/link";
import { AdminListingSupplementImageRejectForm } from "@/components/admin/AdminListingRequestActionButtons";
import { formatDisplayedDateTime } from "@/lib/format-display-datetime";
import { adminApproveListingSupplementImage } from "@/actions/admin-marketplace";

export type AdminSupplementImageRequestRow = {
  id: string;
  shopId: string;
  /** ISO */
  ownerSupplementPendingSubmittedAt: string | null;
  /** ISO */
  updatedAt: string;
  requestItemName: string | null;
  ownerSupplementImageUrl: string | null;
  ownerSupplementPendingImageUrl: string;
  shop: { displayName: string; slug: string };
  product: { name: string; slug: string };
};

export function AdminListingSupplementImageRequestsTab(props: { rows: AdminSupplementImageRequestRow[] }) {
  const { rows } = props;

  return (
    <section aria-label="Custom image review" className="space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Custom listing images</h2>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No pending custom images.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const label = (r.requestItemName?.trim() || r.product.name).trim() || "Listing";
            const submitted = r.ownerSupplementPendingSubmittedAt
              ? formatDisplayedDateTime(r.ownerSupplementPendingSubmittedAt)
              : "—";
            const dashLink = `/s/${encodeURIComponent(r.shop.slug)}/product/${encodeURIComponent(r.product.slug)}`;

            return (
              <li
                key={r.id}
                className="rounded-lg border border-zinc-700/80 bg-zinc-950/40 p-4 text-sm text-zinc-200 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-100">{label}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{r.product.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Pending submitted: <span className="text-zinc-400">{submitted}</span>
                    </p>
                    <p className="mt-2">
                      <Link href={dashLink} className="text-xs text-sky-400 underline-offset-2 hover:underline">
                        Open storefront product
                      </Link>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Live (if any)</p>
                      {r.ownerSupplementImageUrl?.trim() ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.ownerSupplementImageUrl.trim()}
                          alt=""
                          className="h-24 w-24 rounded border border-zinc-600 object-cover"
                        />
                      ) : (
                        <div className="flex h-24 w-24 items-center justify-center rounded border border-zinc-800 bg-zinc-900/60 text-[10px] text-zinc-600">
                          None
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-amber-200/80">Pending</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.ownerSupplementPendingImageUrl.trim()}
                        alt=""
                        className="h-24 w-24 rounded border border-amber-900/45 object-cover"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-start gap-4">
                  <form action={adminApproveListingSupplementImage} className="shrink-0">
                    <input type="hidden" name="listingId" value={r.id} />
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-900/55 px-3 py-1.5 text-xs font-medium text-emerald-100 ring-1 ring-emerald-800/70 hover:bg-emerald-900/75"
                    >
                      Approve
                    </button>
                  </form>
                  <AdminListingSupplementImageRejectForm
                    listingId={r.id}
                    legendId={`admin-supplement-reject-${r.id}`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
