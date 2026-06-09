"use client";

import Link from "next/link";
import { useState } from "react";
import {
  adminGrantShopSecretMenuAccess,
  adminRevokeShopSecretMenuAccess,
  type AdminSecretMenuShopRow,
  type AdminShopSlugPick,
} from "@/actions/admin-secret-menu";
import { formatDisplayedDateTime } from "@/lib/format-display-datetime";

export function AdminSecretMenuShopsPanel(props: {
  shopRows: AdminSecretMenuShopRow[];
  shopPickerOptions: AdminShopSlugPick[];
  smErr?: string;
  smGranted?: string;
  smRevoked?: string;
}) {
  const { shopRows, shopPickerOptions, smErr, smGranted, smRevoked } = props;
  const [shopSlug, setShopSlug] = useState("");

  return (
    <div id="secret-menu-shops" className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Shop access</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
        Only shops on this list see extended catalog items in their listing request picker. Shop
        owners are not notified — items appear as a third catalog section.
      </p>

      {smRevoked && smRevoked.trim() ? (
        <p
          role="status"
          className="mt-3 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200/90"
        >
          Removed extended catalog access for{" "}
          <span className="font-mono text-amber-100">{smRevoked}</span>.
        </p>
      ) : null}
      {smGranted && smGranted.trim() ? (
        <p
          role="status"
          className="mt-3 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90"
        >
          Granted extended catalog access to{" "}
          <span className="font-mono text-emerald-100">{smGranted}</span>.
        </p>
      ) : null}
      {smErr ? (
        <p
          className="mt-3 rounded border border-amber-900/50 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90"
          role="alert"
        >
          {smErr}
        </p>
      ) : null}

      <form action={adminGrantShopSecretMenuAccess} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block min-w-[12rem] flex-1 text-xs text-zinc-500">
          Shop slug
          <input
            type="text"
            name="shopSlug"
            list="secret-menu-shop-slugs"
            value={shopSlug}
            onChange={(e) => setShopSlug(e.target.value)}
            required
            autoComplete="off"
            placeholder="creator-slug"
            className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-sm text-zinc-100"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
        >
          Grant access
        </button>
      </form>
      <datalist id="secret-menu-shop-slugs">
        {shopPickerOptions.map((o) => (
          <option key={o.slug} value={o.slug}>
            {o.displayName}
          </option>
        ))}
      </datalist>

      {shopRows.length === 0 ? (
        <p className="mt-4 text-xs text-zinc-500">No shops have extended catalog access yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-800 text-sm">
          {shopRows.map((r) => (
            <li key={r.slug} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="font-medium text-zinc-200">{r.displayName}</p>
                <p className="font-mono text-xs text-zinc-500">
                  <Link href={`/s/${encodeURIComponent(r.slug)}`} className="text-blue-400/90 hover:underline">
                    /s/{r.slug}
                  </Link>
                  <span className="text-zinc-600"> · since {formatDisplayedDateTime(r.grantedAtIso)}</span>
                </p>
              </div>
              <form action={adminRevokeShopSecretMenuAccess}>
                <input type="hidden" name="shopSlug" value={r.slug} />
                <button
                  type="submit"
                  className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
