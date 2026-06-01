import Link from "next/link";
import { AdminGoogleShoppingExportButton } from "@/components/admin/AdminGoogleShoppingExportButton";
import {
  AdminGoogleShoppingSyncButton,
  GmcSyncStatusBadge,
} from "@/components/admin/AdminGoogleShoppingSyncButton";
import { loadAdminGoogleShoppingEnrollments } from "@/lib/admin-google-shopping-shops";
import { googleMerchantSyncEnabled } from "@/lib/google-merchant/config";

export async function AdminGoogleShoppingTab() {
  const rows = await loadAdminGoogleShoppingEnrollments();
  const merchantApiConfigured = googleMerchantSyncEnabled();

  return (
    <section className="space-y-6" aria-label="Google Shopping enrolled listings">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Google Shopping</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Creators spend one credit per listing to enroll here. New enrollments push to Google right
            away when Merchant API sync is enabled; a reconcile job every two days updates price and
            image changes. Use <span className="text-zinc-400">Sync to Merchant Center</span> anytime
            for a manual run.
          </p>
          {!merchantApiConfigured ? (
            <p className="mt-2 text-xs text-amber-200/80">
              Merchant API sync is off — set{" "}
              <code className="text-amber-100/90">GOOGLE_MERCHANT_SYNC_ENABLED=1</code> and related
              env vars on Vercel.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <AdminGoogleShoppingSyncButton />
          <AdminGoogleShoppingExportButton />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 px-4 py-8 text-sm text-zinc-500">
          No listings are enrolled in Google Shopping yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-950/80 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Shop</th>
                <th className="px-4 py-3 font-medium">Listing</th>
                <th className="px-4 py-3 font-medium">Enrolled</th>
                <th className="px-4 py-3 font-medium">GMC sync</th>
                <th className="px-4 py-3 font-medium">Google approval</th>
                <th className="px-4 py-3 font-medium">Shop active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {rows.map((row) => (
                <tr key={row.listingId} className="text-zinc-300">
                  <td className="px-4 py-3">
                    <span className="font-medium text-zinc-100">{row.shopDisplayName}</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">{row.shopSlug}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={row.listingUrl}
                      className="text-blue-400/90 hover:text-blue-300 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {row.listingLabel}
                    </Link>
                    {row.gmcLastSyncError ? (
                      <p className="mt-1 max-w-xs text-[11px] leading-snug text-red-300/80">
                        {row.gmcLastSyncError}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {new Intl.DateTimeFormat("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(row.enrolledAt))}
                  </td>
                  <td className="px-4 py-3">
                    <GmcSyncStatusBadge status={row.gmcSyncStatus} />
                    {row.gmcLastSyncedAt ? (
                      <span className="mt-0.5 block text-[11px] text-zinc-600">
                        {new Intl.DateTimeFormat("en-US", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(row.gmcLastSyncedAt))}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {row.gmcApprovalStatus ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {row.shopActive ? (
                      <span className="text-emerald-400/90">Yes</span>
                    ) : (
                      <span className="text-amber-400/80">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
