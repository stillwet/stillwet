"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  adminUpdateCatalogItemFormAction,
  type AdminCatalogItemSaveResult,
} from "@/actions/admin-catalog-items";
import {
  dollarsStringFromCents,
  parseAdminCatalogItemArtworkForm,
  validateItemLevelWhenNoVariants,
} from "@/lib/admin-catalog-item";
import { AdminCatalogArtworkRequirementFields } from "@/components/admin/AdminCatalogArtworkRequirementFields";
import { AdminCatalogItemLevelFields } from "@/components/admin/AdminCatalogItemLevelFields";
import {
  AdminCatalogItemTagsEditor,
  type AdminListItemTag,
  type AdminListTagOption,
} from "@/components/admin/AdminCatalogItemTagsEditor";

export type AdminListItemSerializable = {
  id: string;
  name: string;
  storefrontDescription: string | null;
  itemPlatformProductId: string | null;
  itemExampleListingUrl: string | null;
  itemMinPriceCents: number;
  itemGoodsServicesCostCents: number;
  itemImageRequirementLabel: string | null;
  itemPrintAreaWidthPx: number | null;
  itemPrintAreaHeightPx: number | null;
  itemMinArtworkDpi: number | null;
  tags: AdminListItemTag[];
};

export function AdminListItemEditForm({
  item,
  allTags,
  onCancel,
}: {
  item: AdminListItemSerializable;
  allTags: AdminListTagOption[];
  onCancel: () => void;
}) {
  const router = useRouter();
  const [editName, setEditName] = useState(item.name);
  const [editStorefrontDescription, setEditStorefrontDescription] = useState(
    item.storefrontDescription ?? "",
  );
  const [editItemExampleListingUrl, setEditItemExampleListingUrl] = useState(
    item.itemExampleListingUrl ?? "",
  );
  const [editItemMinPriceDollars, setEditItemMinPriceDollars] = useState(
    dollarsStringFromCents(item.itemMinPriceCents),
  );
  const [editItemGoodsServicesCostDollars, setEditItemGoodsServicesCostDollars] = useState(
    dollarsStringFromCents(item.itemGoodsServicesCostCents),
  );
  const [editItemImageRequirementLabel, setEditItemImageRequirementLabel] = useState(
    item.itemImageRequirementLabel ?? "",
  );
  const [editItemPrintAreaWidthPx, setEditItemPrintAreaWidthPx] = useState(
    item.itemPrintAreaWidthPx != null ? String(item.itemPrintAreaWidthPx) : "",
  );
  const [editItemPrintAreaHeightPx, setEditItemPrintAreaHeightPx] = useState(
    item.itemPrintAreaHeightPx != null ? String(item.itemPrintAreaHeightPx) : "",
  );
  const [editItemMinArtworkDpi, setEditItemMinArtworkDpi] = useState(
    item.itemMinArtworkDpi != null ? String(item.itemMinArtworkDpi) : "",
  );
  const [clientError, setClientError] = useState<string | null>(null);

  const [saveState, saveAction, savePending] = useActionState<
    AdminCatalogItemSaveResult | null,
    FormData
  >(adminUpdateCatalogItemFormAction, null);

  useEffect(() => {
    if (saveState?.ok !== true) return;
    onCancel();
    router.refresh();
  }, [saveState, onCancel, router]);

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);
    const name = editName.trim();
    if (!name) {
      setClientError("Enter an item name.");
      return;
    }
    const itemLevel = validateItemLevelWhenNoVariants(
      editItemExampleListingUrl,
      editItemMinPriceDollars,
      editItemGoodsServicesCostDollars,
    );
    if (!itemLevel.ok) {
      setClientError(itemLevel.error);
      return;
    }
    const ar = parseAdminCatalogItemArtworkForm(
      editItemImageRequirementLabel,
      editItemPrintAreaWidthPx,
      editItemPrintAreaHeightPx,
      editItemMinArtworkDpi,
    );
    if (!ar.ok) {
      setClientError(ar.error);
      return;
    }

    const fd = new FormData();
    fd.set("itemId", item.id);
    fd.set("itemName", name);
    fd.set("storefrontDescription", editStorefrontDescription);
    fd.set("itemExampleListingUrl", editItemExampleListingUrl);
    fd.set("itemMinPriceDollars", editItemMinPriceDollars);
    fd.set("itemGoodsServicesCostDollars", editItemGoodsServicesCostDollars);
    fd.set("itemImageRequirementLabel", editItemImageRequirementLabel);
    fd.set("itemPrintAreaWidthPx", editItemPrintAreaWidthPx);
    fd.set("itemPrintAreaHeightPx", editItemPrintAreaHeightPx);
    fd.set("itemMinArtworkDpi", editItemMinArtworkDpi);
    saveAction(fd);
  }

  const serverError = saveState?.ok === false ? saveState.error : null;
  const displayError = clientError ?? serverError;

  return (
    <div className="mb-6 rounded-lg border border-amber-900/50 bg-amber-950/20 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-amber-200/80">Edit item</h3>
      <p className="mt-1 text-[11px] text-zinc-500">Updating “{item.name}”</p>
      <form onSubmit={submitEdit} className="mt-4 space-y-4">
        <label className="block text-xs text-zinc-500">
          Item name
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            maxLength={300}
            className="mt-1 block w-full max-w-xl rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
          />
        </label>
        <AdminCatalogItemLevelFields
          exampleListingUrl={editItemExampleListingUrl}
          minPriceDollars={editItemMinPriceDollars}
          goodsServicesCostDollars={editItemGoodsServicesCostDollars}
          storefrontDescription={editStorefrontDescription}
          onChangeExampleListingUrl={setEditItemExampleListingUrl}
          onChangeMinPriceDollars={setEditItemMinPriceDollars}
          onChangeGoodsServicesCostDollars={setEditItemGoodsServicesCostDollars}
          onChangeStorefrontDescription={setEditStorefrontDescription}
        />
        <AdminCatalogArtworkRequirementFields
          imageRequirementLabel={editItemImageRequirementLabel}
          printAreaWidthPx={editItemPrintAreaWidthPx}
          printAreaHeightPx={editItemPrintAreaHeightPx}
          minArtworkDpi={editItemMinArtworkDpi}
          onChangeImageRequirementLabel={setEditItemImageRequirementLabel}
          onChangePrintAreaWidthPx={setEditItemPrintAreaWidthPx}
          onChangePrintAreaHeightPx={setEditItemPrintAreaHeightPx}
          onChangeMinArtworkDpi={setEditItemMinArtworkDpi}
        />
        {displayError ? (
          <p className="text-xs text-amber-200/90" role="alert">
            {displayError}
          </p>
        ) : null}
        <AdminCatalogItemTagsEditor itemId={item.id} linkedTags={item.tags} allTags={allTags} />
        <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
          <button
            type="submit"
            disabled={savePending}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
          >
            {savePending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            disabled={savePending}
            onClick={onCancel}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
