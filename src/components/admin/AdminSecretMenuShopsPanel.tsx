"use client";

import { useState } from "react";
import {
  adminGrantShopSecretMenuAccess,
  adminRevokeShopSecretMenuAccess,
  type AdminSecretMenuShopRow,
  type AdminShopSlugPick,
} from "@/actions/admin-secret-menu";

export function AdminSecretMenuShopsPanel(props: {
  shopRows: AdminSecretMenuShopRow[];
  shopPickerOptions: AdminShopSlugPick[];
  smErr?: string;
  smGranted?: string;
  smRevoked?: string;
}) {
  const { shopRows, shopPickerOptions, smErr, smGranted, smRevoked } = props;
  const [shopSlug, setShopSlug] = useState("");

  const initiallyOpen =
    shopRows.length > 0 ||
    Boolean(smErr?.trim() || smGranted?.trim() || smRevoked?.trim());
  const [shopsOpen, setShopsOpen] = useState(initiallyOpen);

  const summaryLabel =
    shopRows.length > 0 ? `Shop access (${shopRows.length})` : "Shop access";

  return (
    <div id="secret-menu-shops" className="rounded-lg border border-zinc-800 bg-zinc-950/40">
      <details
        className="group"
        open={shopsOpen}
        onToggle={(e) => setShopsOpen(e.currentTarget.open)}
      >
        <summary className="cursor-pointer select-none list-none px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-zinc-500 hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
          {summaryLabel}
        </summary>

        <div className="space-y-4 border-t border-zinc-800/80 px-3 pb-3 pt-3">
          {smRevoked && smRevoked.trim() ? (
            <p
              role="status"
              className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200/90"
            >
              Removed extended catalog access for{" "}
              <span className="font-mono text-amber-100">{smRevoked}</span>.
            </p>
          ) : null}
          {smGranted && smGranted.trim() ? (
            <p
              role="status"
              className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90"
            >
              Granted extended catalog access to{" "}
              <span className="font-mono text-emerald-100">{smGranted}</span>.
            </p>
          ) : null}
          {smErr ? (
            <p
              className="rounded border border-amber-900/50 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90"
              role="alert"
            >
              {smErr}
            </p>
          ) : null}

          <form action={adminGrantShopSecretMenuAccess} className="flex flex-wrap items-end gap-3">
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
            <p className="text-xs text-zinc-500">No shops have extended catalog access yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-800 text-sm">
              {shopRows.map((r) => (
                <li key={r.slug} className="flex items-center justify-between gap-3 py-2">
                  <p className="min-w-0 truncate font-medium text-zinc-200">{r.displayName}</p>
                  <form action={adminRevokeShopSecretMenuAccess} className="shrink-0">
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
      </details>
    </div>
  );
}
