"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, startTransition, useState } from "react";
import {
  adminAddCatalogItemFormAction,
  type AdminCatalogItemSaveResult,
} from "@/actions/admin-catalog-items";
import { AdminCatalogArtworkRequirementFields } from "@/components/admin/AdminCatalogArtworkRequirementFields";
import {
  AdminCatalogAdvancedFieldsExpand,
  AdminCatalogPicturesExpand,
} from "@/components/admin/AdminCatalogAdvancedFieldsExpand";
import { AdminCatalogItemReferencePhotoFields } from "@/components/admin/AdminCatalogItemReferencePhotoFields";
import {
  AdminCatalogCanvasPresentationFields,
  type CatalogArtworkTemplatePresetId,
} from "@/components/admin/AdminCatalogCanvasPresentationFields";
import type { CatalogCanvasPresentationPresetId } from "@/lib/admin-catalog-canvas-presentation";
import { AdminCatalogItemArtworkSourceTierOverride, ListingArtworkLetterboxFill } from "@/generated/prisma/enums";
import type { CatalogArtworkSourceTierOverride } from "@/lib/listing-artwork-source-tier";
import { AdminCatalogItemLevelFields } from "@/components/admin/AdminCatalogItemLevelFields";
import { AdminCatalogItemSizeExampleFields } from "@/components/admin/AdminCatalogItemSizeExampleFields";
import { parseAdminCatalogItemArtworkForm, validateItemLevelWhenNoVariants } from "@/lib/admin-catalog-item";

export function AdminListAddItemForm({
  secretMenuCatalog = false,
  embedded = false,
  open: controlledOpen,
  onOpenChange,
}: {
  secretMenuCatalog?: boolean;
  /** Render inside secret-menu split card (no standalone trigger). */
  embedded?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [itemName, setItemName] = useState("");
  const [storefrontDescription, setStorefrontDescription] = useState("");
  const [itemExampleListingUrl, setItemExampleListingUrl] = useState("");
  const [itemSizeExampleImageUrl, setItemSizeExampleImageUrl] = useState("");
  const [itemMinPriceDollars, setItemMinPriceDollars] = useState("");
  const [itemGoodsServicesCostDollars, setItemGoodsServicesCostDollars] = useState("");
  const [itemImageRequirementLabel, setItemImageRequirementLabel] = useState("");
  const [itemPrintAreaWidthPx, setItemPrintAreaWidthPx] = useState("");
  const [itemPrintAreaHeightPx, setItemPrintAreaHeightPx] = useState("");
  const [itemMinArtworkDpi, setItemMinArtworkDpi] = useState("");
  const [itemArtworkLetterboxFill, setItemArtworkLetterboxFill] = useState<ListingArtworkLetterboxFill>(
    ListingArtworkLetterboxFill.transparent,
  );
  const [itemArtworkSourceTierOverride, setItemArtworkSourceTierOverride] =
    useState<CatalogArtworkSourceTierOverride>(AdminCatalogItemArtworkSourceTierOverride.auto);
  const [itemCanvasPresentationPreset, setItemCanvasPresentationPreset] =
    useState<CatalogCanvasPresentationPresetId>("flat");
  const [itemArtworkTemplatePreset, setItemArtworkTemplatePreset] =
    useState<CatalogArtworkTemplatePresetId>("none");
  const [clientError, setClientError] = useState<string | null>(null);
  const [internalFormOpen, setInternalFormOpen] = useState(false);
  const formOpen = embedded && controlledOpen !== undefined ? controlledOpen : internalFormOpen;

  function setFormOpen(next: boolean) {
    if (embedded && onOpenChange) onOpenChange(next);
    else setInternalFormOpen(next);
  }

  const [saveState, saveAction, savePending] = useActionState<
    AdminCatalogItemSaveResult | null,
    FormData
  >(adminAddCatalogItemFormAction, null);

  useEffect(() => {
    if (saveState?.ok !== true) return;
    setItemName("");
    setStorefrontDescription("");
    setItemExampleListingUrl("");
    setItemSizeExampleImageUrl("");
    setItemMinPriceDollars("");
    setItemGoodsServicesCostDollars("");
    setItemImageRequirementLabel("");
    setItemPrintAreaWidthPx("");
    setItemPrintAreaHeightPx("");
    setItemMinArtworkDpi("");
    setItemArtworkLetterboxFill(ListingArtworkLetterboxFill.transparent);
    setItemArtworkSourceTierOverride(AdminCatalogItemArtworkSourceTierOverride.auto);
    setItemCanvasPresentationPreset("flat");
    setItemArtworkTemplatePreset("none");
    setClientError(null);
    setFormOpen(false);
    router.refresh();
  }, [saveState, router]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);
    const name = itemName.trim();
    if (!name) {
      setClientError("Enter an item name.");
      return;
    }
    const itemLevel = validateItemLevelWhenNoVariants(
      itemExampleListingUrl,
      itemMinPriceDollars,
      itemGoodsServicesCostDollars,
    );
    if (!itemLevel.ok) {
      setClientError(itemLevel.error);
      return;
    }
    const ar = parseAdminCatalogItemArtworkForm(
      itemImageRequirementLabel,
      itemPrintAreaWidthPx,
      itemPrintAreaHeightPx,
      itemMinArtworkDpi,
      itemArtworkLetterboxFill,
      itemArtworkSourceTierOverride,
    );
    if (!ar.ok) {
      setClientError(ar.error);
      return;
    }

    const fd = new FormData();
    fd.set("itemName", name);
    fd.set("storefrontDescription", storefrontDescription);
    fd.set("itemExampleListingUrl", itemExampleListingUrl);
    fd.set("itemSizeExampleImageUrl", itemSizeExampleImageUrl);
    fd.set("itemMinPriceDollars", itemMinPriceDollars);
    fd.set("itemGoodsServicesCostDollars", itemGoodsServicesCostDollars);
    fd.set("itemImageRequirementLabel", itemImageRequirementLabel);
    fd.set("itemPrintAreaWidthPx", itemPrintAreaWidthPx);
    fd.set("itemPrintAreaHeightPx", itemPrintAreaHeightPx);
    fd.set("itemMinArtworkDpi", itemMinArtworkDpi);
    fd.set("itemArtworkLetterboxFill", itemArtworkLetterboxFill);
    fd.set("itemArtworkSourceTierOverride", itemArtworkSourceTierOverride);
    fd.set("itemCanvasPresentationPreset", itemCanvasPresentationPreset);
    fd.set("itemArtworkTemplatePreset", itemArtworkTemplatePreset);
    if (secretMenuCatalog) {
      fd.set("itemSecretMenuOnly", "1");
    }
    startTransition(() => {
      saveAction(fd);
    });
  }

  const serverError = saveState?.ok === false ? saveState.error : null;
  const displayError = clientError ?? serverError;

  if (embedded && !formOpen) return null;

  if (!formOpen) {
    return (
      <button
        type="button"
        onClick={() => setFormOpen(true)}
        className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-800/70 hover:text-zinc-100"
      >
        Add new catalogue item
      </button>
    );
  }

  return (
    <div
      className={
        embedded
          ? "mt-3 border-t border-zinc-800/80 pt-3"
          : "rounded-lg border border-zinc-800 bg-zinc-900/30 p-4"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {secretMenuCatalog ? "Secret menu item" : "List item"}
        </h3>
        <button
          type="button"
          onClick={() => {
            setFormOpen(false);
            setClientError(null);
          }}
          className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
        >
          Cancel
        </button>
      </div>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <label className="block text-xs text-zinc-500">
          Item name
          <input
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            required
            maxLength={300}
            className="mt-1 block w-full max-w-xl rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            placeholder="e.g. Ceramic mug"
          />
        </label>

        <AdminCatalogItemLevelFields
          minPriceDollars={itemMinPriceDollars}
          goodsServicesCostDollars={itemGoodsServicesCostDollars}
          storefrontDescription={storefrontDescription}
          onChangeMinPriceDollars={setItemMinPriceDollars}
          onChangeGoodsServicesCostDollars={setItemGoodsServicesCostDollars}
          onChangeStorefrontDescription={setStorefrontDescription}
        />
        <AdminCatalogPicturesExpand>
          <AdminCatalogItemReferencePhotoFields
            exampleListingUrl={itemExampleListingUrl}
            onChangeExampleListingUrl={setItemExampleListingUrl}
          />
          <AdminCatalogItemSizeExampleFields
            sizeExampleImageUrl={itemSizeExampleImageUrl}
            onChangeSizeExampleImageUrl={setItemSizeExampleImageUrl}
          />
        </AdminCatalogPicturesExpand>
        <AdminCatalogAdvancedFieldsExpand>
          <AdminCatalogArtworkRequirementFields
            imageRequirementLabel={itemImageRequirementLabel}
            printAreaWidthPx={itemPrintAreaWidthPx}
            printAreaHeightPx={itemPrintAreaHeightPx}
            minArtworkDpi={itemMinArtworkDpi}
            artworkLetterboxFill={itemArtworkLetterboxFill}
            artworkSourceTierOverride={itemArtworkSourceTierOverride}
            onChangeImageRequirementLabel={setItemImageRequirementLabel}
            onChangePrintAreaWidthPx={setItemPrintAreaWidthPx}
            onChangePrintAreaHeightPx={setItemPrintAreaHeightPx}
            onChangeMinArtworkDpi={setItemMinArtworkDpi}
            onChangeArtworkLetterboxFill={setItemArtworkLetterboxFill}
            onChangeArtworkSourceTierOverride={setItemArtworkSourceTierOverride}
          />

          <AdminCatalogCanvasPresentationFields
            canvasPresentationPreset={itemCanvasPresentationPreset}
            artworkTemplatePreset={itemArtworkTemplatePreset}
            onChangeCanvasPresentationPreset={setItemCanvasPresentationPreset}
            onChangeArtworkTemplatePreset={setItemArtworkTemplatePreset}
          />
        </AdminCatalogAdvancedFieldsExpand>

        {displayError ? (
          <p className="text-xs text-amber-200/90" role="alert">
            {displayError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={savePending}
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
        >
          {savePending ? "Saving…" : "Save item"}
        </button>
      </form>
    </div>
  );
}
