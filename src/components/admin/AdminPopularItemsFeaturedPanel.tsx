"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  adminSavePopularItemsFeaturedInitialState,
} from "@/actions/admin-popular-items-featured-state";
import { adminSavePopularItemsFeaturedProductIdsForm } from "@/actions/admin-popular-items-featured";
import {
  HOME_HOT_CAROUSEL_DEFAULT_DISPLAY,
  HOME_HOT_CAROUSEL_MAX_ITEMS,
} from "@/lib/platform-all-page-featured-constants";
import { AdminFeaturedProductPickerByShop } from "@/components/admin/AdminFeaturedProductPickerByShop";

export function AdminPopularItemsFeaturedPanel(props: {
  shops: { id: string; displayName: string }[];
  productsByShopId: Record<string, { productId: string; label: string }[]>;
  labelsByProductId: Record<string, string>;
  initialProductIds: string[];
}) {
  const { shops, productsByShopId, labelsByProductId, initialProductIds } = props;
  const router = useRouter();
  const [ids, setIds] = useState<string[]>(initialProductIds);
  const [state, formAction] = useActionState(
    adminSavePopularItemsFeaturedProductIdsForm,
    adminSavePopularItemsFeaturedInitialState,
  );

  useEffect(() => {
    if (state.ok) void router.refresh();
  }, [state.ok, router]);

  const labelById = useMemo(() => new Map(Object.entries(labelsByProductId)), [labelsByProductId]);

  function remove(id: string) {
    setIds((prev) => prev.filter((x) => x !== id));
  }

  function add(id: string) {
    setIds((prev) => {
      if (prev.includes(id) || prev.length >= HOME_HOT_CAROUSEL_MAX_ITEMS) return prev;
      return [...prev, id];
    });
  }

  function move(idx: number, dir: -1 | 1) {
    setIds((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const t = next[idx]!;
      next[idx] = next[j]!;
      next[j] = t;
      return next;
    });
  }

  return (
    <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-zinc-100">Popular items list</h3>
      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-500">
        Default order follows active{" "}
        <span className="font-medium text-zinc-400">Popular item</span> paid placements (newest
        payment first). Saving a list pins that order on the marketing home page (up to{" "}
        {HOME_HOT_CAROUSEL_MAX_ITEMS} items). With no saved list, visitors see up to{" "}
        {HOME_HOT_CAROUSEL_DEFAULT_DISPLAY} items — Popular item promotions first, then highest PDP
        views, then any live listing. Use Up/Down to reorder. Clear all restores automatic
        promotion-based ordering.
      </p>
      <div className="mt-3 max-w-3xl border-t border-zinc-800/80 pt-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
          Reference — tag pages “Popular” sort
        </p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
          Creator dashboards sell <span className="font-medium text-zinc-500">Popular item</span>{" "}
          placements for visibility in tag browse when shoppers sort by Popular; this strip surfaces
          those promotions on the public home carousel using the same paid-placement ordering logic.
        </p>
      </div>

      {state.error ? (
        <p className="mt-3 rounded-md border border-amber-900/50 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="mt-3 rounded-md border border-emerald-900/50 bg-emerald-950/25 px-3 py-2 text-xs text-emerald-200/90">
          Saved. Refresh the public home page to see changes.
        </p>
      ) : null}

      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="productIdsJson" value={JSON.stringify(ids)} />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Order ({ids.length}/{HOME_HOT_CAROUSEL_MAX_ITEMS})
          </p>
          {ids.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-600">
              None — home carousel uses Popular item promotions, then views, then any live listing.
            </p>
          ) : (
            <ol className="mt-2 space-y-2">
              {ids.map((id, idx) => (
                <li
                  key={id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800/90 bg-zinc-900/40 px-3 py-2 text-xs"
                >
                  <span className="min-w-0 text-zinc-200">
                    <span className="tabular-nums text-zinc-500">{idx + 1}. </span>
                    {labelById.get(id) ?? id}
                  </span>
                  <span className="flex shrink-0 flex-wrap gap-1">
                    <button
                      type="button"
                      className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                      disabled={idx === 0}
                      onClick={() => move(idx, -1)}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                      disabled={idx >= ids.length - 1}
                      onClick={() => move(idx, 1)}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className="rounded border border-red-900/50 px-2 py-0.5 text-[11px] text-red-200/90 hover:bg-red-950/30"
                      onClick={() => remove(id)}
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Add live catalog item</p>
          {shops.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-600">No creator shops with live marketplace listings.</p>
          ) : (
            <AdminFeaturedProductPickerByShop
              shops={shops}
              productsByShopId={productsByShopId}
              selectedProductIds={ids}
              maxSelectable={HOME_HOT_CAROUSEL_MAX_ITEMS}
              onAddProduct={add}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
          >
            Save popular item picks
          </button>
          <button
            type="button"
            className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
            onClick={() => setIds([])}
          >
            Clear all
          </button>
        </div>
      </form>
    </div>
  );
}
