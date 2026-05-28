import Link from "next/link";
import type {
  AdminShopFreeListingGrantRow,
  AdminShopSlugPick,
} from "@/actions/admin-shop-free-listings";
import { AdminFreeListingGrantForm } from "@/components/admin/AdminFreeListingGrantForm";
import { LISTING_FEE_FREE_SLOT_COUNT } from "@/lib/marketplace-constants";

export function AdminShopFreeListingsTab(props: {
  grantRows: AdminShopFreeListingGrantRow[];
  shopPickerOptions: AdminShopSlugPick[];
  flErr?: string;
  flSaved?: boolean;
  flShop?: string;
  flGranted?: number;
  flTotalBonus?: number;
  flTotalCap?: number;
}) {
  const { grantRows, shopPickerOptions, flErr, flSaved, flShop, flGranted, flTotalBonus, flTotalCap } =
    props;

  return (
    <section id="free-listings" aria-label="Grant free listing slots">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Free listing grants</h2>
      <p className="mt-1 text-xs leading-relaxed text-zinc-600">
        Each creator shop gets {LISTING_FEE_FREE_SLOT_COUNT} free publication-fee listings by default (by listing
        creation order). Grants here add bonus slots on top of that — the shop owner does not enter a code.
      </p>

      {flSaved && flShop ? (
        <p
          role="status"
          className="mt-3 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90"
        >
          Granted {flGranted ?? 0} extra free listing{(flGranted ?? 0) === 1 ? "" : "s"} to{" "}
          <span className="font-mono text-emerald-100">{flShop}</span>. They now have{" "}
          <strong className="font-medium">{flTotalBonus ?? 0}</strong> admin bonus slot
          {(flTotalBonus ?? 0) === 1 ? "" : "s"} (
          <strong className="font-medium">{flTotalCap ?? LISTING_FEE_FREE_SLOT_COUNT}</strong> fee-free listings
          total, including the default {LISTING_FEE_FREE_SLOT_COUNT}).
        </p>
      ) : null}
      {flErr ? (
        <p className="mt-3 rounded border border-amber-900/50 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90" role="alert">
          {flErr}
        </p>
      ) : null}

      <AdminFreeListingGrantForm shopPickerOptions={shopPickerOptions} />

      <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Shops with admin bonus slots</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
          Bonus count only (default {LISTING_FEE_FREE_SLOT_COUNT} free listings are not listed here unless a grant was
          applied).
        </p>
        {grantRows.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">No bonus slots granted yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-800 text-sm">
            {grantRows.map((r) => (
              <li key={r.slug} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-200">{r.displayName}</p>
                  <p className="font-mono text-xs text-zinc-500">
                    <Link href={`/s/${encodeURIComponent(r.slug)}`} className="text-blue-400/90 hover:underline">
                      /s/{r.slug}
                    </Link>
                  </p>
                </div>
                <p className="shrink-0 text-xs tabular-nums text-zinc-400">
                  +{r.listingFeeBonusFreeSlots} bonus · {r.totalFreeCap} fee-free total
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
