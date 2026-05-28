import Link from "next/link";
import { AdminGoogleShoppingExportButton } from "@/components/admin/AdminGoogleShoppingExportButton";
import { loadAdminGoogleShoppingEnrollments } from "@/lib/admin-google-shopping-shops";

export async function AdminGoogleShoppingTab() {
  const rows = await loadAdminGoogleShoppingEnrollments();

  return (
    <section className="space-y-6" aria-label="Google Shopping enrolled listings">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Google Shopping</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Listings creators permanently enrolled for the platform Google Merchant Center feed. Use
            the CSV for feed operations (<code className="text-zinc-400">listing_url</code> per row).
          </p>
        </div>
        <AdminGoogleShoppingExportButton />
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
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {new Intl.DateTimeFormat("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(row.enrolledAt))}
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
