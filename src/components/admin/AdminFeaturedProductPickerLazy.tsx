"use client";

import { useEffect, useState } from "react";
import type { PromotionKind } from "@/generated/prisma/enums";
import {
  fetchAdminFeaturedProductPicker,
  fetchAdminPermanentFeaturedProductPicker,
} from "@/actions/admin-promotion-lists";
import type { AdminFeaturedProductPickerPayload } from "@/lib/admin-promotion-lists-load";
import { AdminFeaturedProductPickerByShop } from "@/components/admin/AdminFeaturedProductPickerByShop";
import { promotionKindLabel } from "@/lib/promotions";

/** Defers picklist load until the admin opens the add picker. */
export function AdminFeaturedProductPickerLazy(props: {
  pickerMode: "active" | "permanent";
  promotionKind?: PromotionKind;
  selectedProductIds: string[];
  maxSelectable: number;
  onAddProduct: (productId: string, label?: string) => void;
  labelsByProductId: Record<string, string>;
}) {
  const { pickerMode, promotionKind } = props;
  const kindLabel = promotionKind != null ? promotionKindLabel(promotionKind) : "placement";
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState<AdminFeaturedProductPickerPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || picker) return;
    if (pickerMode === "active" && promotionKind == null) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    const load =
      pickerMode === "permanent"
        ? fetchAdminPermanentFeaturedProductPicker()
        : fetchAdminFeaturedProductPicker(promotionKind!);

    void load
      .then((data) => {
        if (!cancelled) setPicker(data);
      })
      .catch((e) => {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg.trim() || "Could not load picker.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, picker, pickerMode, promotionKind]);

  const addLabel =
    pickerMode === "permanent" ? "Add live catalog item" : `Add active ${kindLabel} placement`;

  const emptyMessage =
    pickerMode === "permanent"
      ? "No live marketplace listings available."
      : `No active ${kindLabel} promotions in the current window.`;

  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{addLabel}</p>
      {!open ? (
        <button
          type="button"
          className="mt-2 rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 hover:bg-zinc-900"
          onClick={() => setOpen(true)}
        >
          {pickerMode === "permanent" ? "Load catalog picker" : "Load promotion picker"}
        </button>
      ) : loading ? (
        <p className="mt-2 text-xs text-zinc-500">
          {pickerMode === "permanent" ? "Loading live listings…" : "Loading active placements…"}
        </p>
      ) : error ? (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-red-300/90">{error}</p>
          <button
            type="button"
            className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-900"
            onClick={() => {
              setError(null);
              setPicker(null);
            }}
          >
            Try again
          </button>
        </div>
      ) : picker && picker.shops.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-600">{emptyMessage}</p>
      ) : picker ? (
        <AdminFeaturedProductPickerByShop
          shops={picker.shops}
          productsByShopId={picker.productsByShopId}
          selectedProductIds={props.selectedProductIds}
          maxSelectable={props.maxSelectable}
          onAddProduct={(productId, label) => {
            props.onAddProduct(
              productId,
              label ?? picker.labelsByProductId[productId],
            );
          }}
        />
      ) : null}
    </div>
  );
}
