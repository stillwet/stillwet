"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  adminSavePopularItemsFeaturedInitialState,
} from "@/actions/admin-popular-items-featured-state";
import { adminSavePopularItemsFeaturedProductIdsForm } from "@/actions/admin-popular-items-featured";
import { HOME_HOT_CAROUSEL_MAX_ITEMS } from "@/lib/platform-all-page-featured-constants";
import { AdminActivePromotionsReadOnlyList } from "@/components/admin/AdminActivePromotionsReadOnlyList";
import { AdminFeaturedListSaveButton } from "@/components/admin/AdminFeaturedListSaveButton";
import { AdminFeaturedProductPickerLazy } from "@/components/admin/AdminFeaturedProductPickerLazy";

export function AdminPopularItemsFeaturedPanel(props: {
  activeProductIds: string[];
  permanentProductIds: string[];
  labelsByProductId: Record<string, string>;
}) {
  const { activeProductIds, permanentProductIds, labelsByProductId } = props;
  const router = useRouter();
  const [ids, setIds] = useState<string[]>(permanentProductIds);
  const [pickedLabelsByProductId, setPickedLabelsByProductId] = useState<Record<string, string>>({});
  const [savedFlash, setSavedFlash] = useState(false);
  const [state, formAction] = useActionState(
    adminSavePopularItemsFeaturedProductIdsForm,
    adminSavePopularItemsFeaturedInitialState,
  );

  const dirty = useMemo(() => {
    if (ids.length !== permanentProductIds.length) return true;
    return ids.some((id, i) => id !== permanentProductIds[i]);
  }, [ids, permanentProductIds]);

  useEffect(() => {
    setIds(permanentProductIds);
  }, [permanentProductIds]);

  useEffect(() => {
    if (state.ok) {
      setSavedFlash(true);
      void router.refresh();
    }
  }, [state.ok, router]);

  useEffect(() => {
    if (dirty) setSavedFlash(false);
  }, [dirty]);

  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const [id, label] of Object.entries(labelsByProductId)) m.set(id, label);
    for (const [id, label] of Object.entries(pickedLabelsByProductId)) m.set(id, label);
    return m;
  }, [labelsByProductId, pickedLabelsByProductId]);

  function add(id: string, label?: string) {
    if (label?.trim()) {
      setPickedLabelsByProductId((prev) => ({ ...prev, [id]: label.trim() }));
    }
    setIds((prev) => {
      if (prev.includes(id) || prev.length >= HOME_HOT_CAROUSEL_MAX_ITEMS) return prev;
      return [...prev, id];
    });
  }

  function remove(id: string) {
    setIds((prev) => prev.filter((x) => x !== id));
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
        Section A shows paid <span className="font-medium text-zinc-400">Popular item</span> placements active
        in the current Pacific window. Section B is your permanent pin for the home carousel — when saved and
        non-empty, the public site uses that order instead of active promotions (clear to fall back).
      </p>

      <AdminActivePromotionsReadOnlyList
        title="Active promotions (this window)"
        ids={activeProductIds}
        labelsById={labelsByProductId}
        emptyMessage="No active Popular item promotions in the current window."
      />

      {state.error ? (
        <p className="mt-3 rounded-md border border-amber-900/50 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90">
          {state.error}
        </p>
      ) : null}

      <form action={formAction} className="mt-4 space-y-4 border-t border-zinc-800/80 pt-4">
        <input type="hidden" name="productIdsJson" value={JSON.stringify(ids)} />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Permanently featured ({ids.length}/{HOME_HOT_CAROUSEL_MAX_ITEMS})
          </p>
          {ids.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-600">
              No permanent picks — home carousel uses active promotions, then automatic backfill.
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

        <AdminFeaturedProductPickerLazy
          pickerMode="permanent"
          selectedProductIds={ids}
          maxSelectable={HOME_HOT_CAROUSEL_MAX_ITEMS}
          onAddProduct={add}
          labelsByProductId={labelsByProductId}
        />

        <div className="flex flex-wrap items-center gap-3">
          <AdminFeaturedListSaveButton dirty={dirty} savedFlash={savedFlash} />
          <button
            type="button"
            className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
            onClick={() => setIds([])}
          >
            Clear permanent list
          </button>
        </div>
      </form>
    </div>
  );
}
