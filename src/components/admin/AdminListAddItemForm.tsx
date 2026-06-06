"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  adminAddCatalogItemFormAction,
  type AdminCatalogItemSaveResult,
} from "@/actions/admin-catalog-items";
import { AdminCatalogArtworkRequirementFields } from "@/components/admin/AdminCatalogArtworkRequirementFields";
import { AdminCatalogItemArtworkSourceTierOverride, ListingArtworkLetterboxFill } from "@/generated/prisma/enums";
import type { CatalogArtworkSourceTierOverride } from "@/lib/listing-artwork-source-tier";
import { AdminCatalogItemLevelFields } from "@/components/admin/AdminCatalogItemLevelFields";
import { parseAdminCatalogItemArtworkForm, validateItemLevelWhenNoVariants } from "@/lib/admin-catalog-item";

export function AdminListAddItemForm() {
  const router = useRouter();
  const [itemName, setItemName] = useState("");
  const [storefrontDescription, setStorefrontDescription] = useState("");
  const [itemExampleListingUrl, setItemExampleListingUrl] = useState("");
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
  const [clientError, setClientError] = useState<string | null>(null);

  const [saveState, saveAction, savePending] = useActionState<
    AdminCatalogItemSaveResult | null,
    FormData
  >(adminAddCatalogItemFormAction, null);

  useEffect(() => {
    if (saveState?.ok !== true) return;
    setItemName("");
    setStorefrontDescription("");
    setItemExampleListingUrl("");
    setItemMinPriceDollars("");
    setItemGoodsServicesCostDollars("");
    setItemImageRequirementLabel("");
    setItemPrintAreaWidthPx("");
    setItemPrintAreaHeightPx("");
    setItemMinArtworkDpi("");
    setItemArtworkLetterboxFill(ListingArtworkLetterboxFill.transparent);
    setItemArtworkSourceTierOverride(AdminCatalogItemArtworkSourceTierOverride.auto);
    setClientError(null);
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
    fd.set("itemMinPriceDollars", itemMinPriceDollars);
    fd.set("itemGoodsServicesCostDollars", itemGoodsServicesCostDollars);
    fd.set("itemImageRequirementLabel", itemImageRequirementLabel);
    fd.set("itemPrintAreaWidthPx", itemPrintAreaWidthPx);
    fd.set("itemPrintAreaHeightPx", itemPrintAreaHeightPx);
    fd.set("itemMinArtworkDpi", itemMinArtworkDpi);
    fd.set("itemArtworkLetterboxFill", itemArtworkLetterboxFill);
    fd.set("itemArtworkSourceTierOverride", itemArtworkSourceTierOverride);
    saveAction(fd);
  }

  const serverError = saveState?.ok === false ? saveState.error : null;
  const displayError = clientError ?? serverError;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">List item</h3>
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
          exampleListingUrl={itemExampleListingUrl}
          minPriceDollars={itemMinPriceDollars}
          goodsServicesCostDollars={itemGoodsServicesCostDollars}
          storefrontDescription={storefrontDescription}
          onChangeExampleListingUrl={setItemExampleListingUrl}
          onChangeMinPriceDollars={setItemMinPriceDollars}
          onChangeGoodsServicesCostDollars={setItemGoodsServicesCostDollars}
          onChangeStorefrontDescription={setStorefrontDescription}
        />
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
