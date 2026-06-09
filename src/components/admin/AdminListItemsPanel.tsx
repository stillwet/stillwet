"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { adminDeleteCatalogItem } from "@/actions/admin-catalog-items";
import type { AdminListItemTag, AdminListTagOption } from "@/components/admin/AdminCatalogItemTagsEditor";
import {
  AdminListItemEditForm,
  type AdminListItemSerializable,
} from "@/components/admin/AdminListItemEditForm";
import {
  LISTING_REQUEST_ARTWORK_STORED_MAX_MB,
  LISTING_REQUEST_ARTWORK_UPLOAD_MAX_MB,
} from "@/lib/listing-request-artwork-limits";

export type { AdminListItemSerializable, AdminListItemTag, AdminListTagOption };

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function minPriceDisplayText(minPriceCents: number, exampleUrl: string) {
  if (minPriceCents === 0 && !exampleUrl.trim()) return "—";
  return formatMoney(minPriceCents);
}

function AdminCatalogItemTagsDisplayCell({ tags }: { tags: AdminListItemTag[] }) {
  return (
    <td className="max-w-[14rem] p-3 align-top text-zinc-300">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span
            key={t.id}
            className="inline-flex max-w-full rounded-full border border-zinc-600 bg-zinc-900/80 px-2 py-0.5 text-[11px] text-zinc-200"
            title={t.name}
          >
            <span className="min-w-0 truncate">{t.name}</span>
          </span>
        ))}
        {tags.length === 0 ? <span className="text-[11px] text-zinc-600">—</span> : null}
      </div>
    </td>
  );
}

function AdminCatalogItemImageCell({ url }: { url: string }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const t = url.trim();
  const path = t.split(/[?#]/)[0] ?? t;
  const looksLikeImage = t.length > 0 && /\.(png|jpe?g|webp|gif|svg)$/i.test(path);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);

  if (!t) return null;

  if (looksLikeImage) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          title="View item image"
          className="rounded border border-transparent p-0 hover:border-zinc-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- admin catalog reference URL */}
          <img
            src={t}
            alt=""
            className="size-10 shrink-0 rounded border border-zinc-700 bg-zinc-900 object-contain"
          />
        </button>
        {lightboxOpen ? (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Item image preview"
            onClick={() => setLightboxOpen(false)}
          >
            <div
              className="relative max-w-[min(80vw,560px)] rounded-xl border border-zinc-700 bg-zinc-950 p-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Close image preview"
                className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-md text-lg leading-none text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                onClick={() => setLightboxOpen(false)}
              >
                ×
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element -- admin catalog reference URL */}
              <img
                src={t}
                alt=""
                className="mx-auto max-h-[min(65vh,420px)] w-full object-contain"
              />
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <a
      href={t}
      target="_blank"
      rel="noopener noreferrer"
      title="Open item image URL"
      className="break-all text-[11px] text-blue-400/90 hover:underline"
    >
      {t.length > 40 ? `${t.slice(0, 38)}…` : t}
    </a>
  );
}

export function AdminListItemsPanel({
  items,
  allTags,
  r2Configured = false,
}: {
  items: AdminListItemSerializable[];
  allTags: AdminListTagOption[];
  r2Configured?: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ itemId: string; itemName: string } | null>(
    null,
  );

  useEffect(() => {
    if (!deleteDialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deletePending) setDeleteDialog(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteDialog, deletePending]);

  function openDeleteCatalogItemDialog(itemId: string, itemName: string) {
    setDeleteDialog({ itemId, itemName });
  }

  function closeDeleteCatalogItemDialog() {
    if (deletePending) return;
    setDeleteDialog(null);
  }

  function confirmDeleteCatalogItemFromDialog() {
    if (!deleteDialog || deletePending) return;
    const { itemId } = deleteDialog;
    const fd = new FormData();
    fd.set("itemId", itemId);
    setDeletingItemId(itemId);
    startDeleteTransition(async () => {
      try {
        await adminDeleteCatalogItem(fd);
        if (editingId === itemId) cancelEdit();
        router.refresh();
      } finally {
        setDeletingItemId(null);
        setDeleteDialog(null);
      }
    });
  }

  function beginEditItem(itemId: string) {
    if (items.some((x) => x.id === itemId)) setEditingId(itemId);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  const editingItem = editingId ? items.find((x) => x.id === editingId) : null;

  return (
    <>
      {editingId && editingItem ? (
        <AdminListItemEditForm
          key={editingId}
          item={editingItem}
          allTags={allTags}
          onCancel={cancelEdit}
          r2Configured={r2Configured}
        />
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full min-w-[56rem] text-left text-xs">
          <thead className="border-b border-zinc-800 bg-zinc-900/80 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="p-3 font-medium">Item name</th>
              <th className="p-3 font-medium">Tags</th>
              <th className="p-3 font-medium">Item image</th>
              <th className="p-3 font-medium whitespace-nowrap">Size Ex Pic</th>
              <th className="p-3 font-medium whitespace-nowrap" title="Goods/services fulfillment cost per unit">
                G/S cost
              </th>
              <th className="p-3 font-medium whitespace-nowrap">Min price</th>
              <th className="p-3 font-medium max-w-[12rem]">Artwork / DPI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/90 text-zinc-300">
            {items.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="p-3 font-medium text-zinc-200">
                  <div>{item.name}</div>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                    <button
                      type="button"
                      onClick={() => beginEditItem(item.id)}
                      className="text-[11px] text-blue-400/90 hover:underline"
                    >
                      Edit item
                    </button>
                    <button
                      type="button"
                      disabled={deletePending || deleteDialog !== null}
                      onClick={() => openDeleteCatalogItemDialog(item.id, item.name)}
                      className="text-[11px] text-blue-400/90 hover:underline disabled:opacity-50"
                      title="Delete this catalog item"
                    >
                      {deletingItemId === item.id ? "Deleting…" : "Delete item"}
                    </button>
                  </div>
                </td>
                <AdminCatalogItemTagsDisplayCell tags={item.tags} />
                <td className="p-3 text-zinc-400">
                  {item.itemExampleListingUrl ? (
                    <AdminCatalogItemImageCell url={item.itemExampleListingUrl} />
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="p-3 text-zinc-400">
                  {item.itemSizeExampleImageUrl ? (
                    <AdminCatalogItemImageCell url={item.itemSizeExampleImageUrl} />
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="p-3 whitespace-nowrap tabular-nums text-zinc-400">
                  {formatMoney(item.itemGoodsServicesCostCents)}
                </td>
                <td className="p-3 whitespace-nowrap tabular-nums text-zinc-400">
                  {minPriceDisplayText(item.itemMinPriceCents, item.itemExampleListingUrl ?? "")}
                </td>
                <td className="max-w-[12rem] p-3 align-top text-zinc-400">
                  <div className="text-[11px] leading-relaxed">
                    <p className="tabular-nums text-zinc-500">
                      Upload: {LISTING_REQUEST_ARTWORK_UPLOAD_MAX_MB} MB (stored ≤
                      {LISTING_REQUEST_ARTWORK_STORED_MAX_MB} MB)
                    </p>
                    {item.itemPrintAreaWidthPx != null &&
                    item.itemPrintAreaHeightPx != null &&
                    item.itemPrintAreaWidthPx > 0 &&
                    item.itemPrintAreaHeightPx > 0 ? (
                      <>
                        {item.itemImageRequirementLabel?.trim() ? (
                          <p className="mt-0.5 text-zinc-300">{item.itemImageRequirementLabel.trim()}</p>
                        ) : null}
                        <p className="mt-0.5 tabular-nums text-zinc-500">
                          Print area: {item.itemPrintAreaWidthPx}×{item.itemPrintAreaHeightPx}px
                        </p>
                        {item.itemMinArtworkDpi != null && item.itemMinArtworkDpi > 0 ? (
                          <p className="mt-0.5 tabular-nums text-zinc-500">Min DPI: {item.itemMinArtworkDpi}</p>
                        ) : null}
                      </>
                    ) : item.itemImageRequirementLabel?.trim() ? (
                      <p className="mt-0.5 text-zinc-300">{item.itemImageRequirementLabel.trim()}</p>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">No items yet — use List item above.</p>
      ) : null}

      {deleteDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-delete-catalog-item-title"
          onClick={closeDeleteCatalogItemDialog}
        >
          <div
            className="max-w-md rounded-xl border border-zinc-700 bg-zinc-950 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="admin-delete-catalog-item-title"
              className="text-base font-semibold text-zinc-100"
            >
              Delete catalog item?
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              This will remove{" "}
              <span className="font-medium text-zinc-200">
                “{(deleteDialog.itemName.trim() || "this item").slice(0, 200)}”
              </span>{" "}
              from the baseline list. This cannot be undone.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={deletePending}
                onClick={closeDeleteCatalogItemDialog}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletePending}
                onClick={confirmDeleteCatalogItemFromDialog}
                className="rounded-lg border border-red-900/60 bg-red-950/50 px-4 py-2 text-sm font-medium text-red-100 hover:bg-red-950/70 disabled:opacity-50"
              >
                {deletePending ? "Deleting…" : "Delete item"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
