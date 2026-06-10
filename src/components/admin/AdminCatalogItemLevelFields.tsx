"use client";

import { AdminCatalogPrintAreaFields } from "@/components/admin/AdminCatalogArtworkRequirementFields";

export function AdminCatalogItemLevelFields({
  minPriceDollars,
  goodsServicesCostDollars,
  productionFeeDollars,
  storefrontDescription,
  printAreaWidthPx,
  printAreaHeightPx,
  minArtworkDpi,
  onChangeMinPriceDollars,
  onChangeGoodsServicesCostDollars,
  onChangeProductionFeeDollars,
  onChangeStorefrontDescription,
  onChangePrintAreaWidthPx,
  onChangePrintAreaHeightPx,
  onChangeMinArtworkDpi,
}: {
  minPriceDollars: string;
  goodsServicesCostDollars: string;
  productionFeeDollars: string;
  storefrontDescription: string;
  printAreaWidthPx: string;
  printAreaHeightPx: string;
  minArtworkDpi: string;
  onChangeMinPriceDollars: (v: string) => void;
  onChangeGoodsServicesCostDollars: (v: string) => void;
  onChangeProductionFeeDollars: (v: string) => void;
  onChangeStorefrontDescription: (v: string) => void;
  onChangePrintAreaWidthPx: (v: string) => void;
  onChangePrintAreaHeightPx: (v: string) => void;
  onChangeMinArtworkDpi: (v: string) => void;
}) {
  return (
    <div className="space-y-3 rounded border border-zinc-800/80 bg-zinc-950/40 p-3">
      <label className="block min-w-0 text-[11px] text-zinc-500">
        Storefront description (optional)
        <textarea
          value={storefrontDescription}
          onChange={(e) => onChangeStorefrontDescription(e.target.value)}
          rows={4}
          className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200"
          placeholder="Only this admin text is shown on the public product page for linked listings. Printify product descriptions are not used."
        />
      </label>
      <label className="block max-w-[10rem] text-[11px] text-zinc-500">
        Min price (USD)
        <input
          type="text"
          inputMode="decimal"
          value={minPriceDollars}
          onChange={(e) => onChangeMinPriceDollars(e.target.value)}
          className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-sm text-zinc-100"
          placeholder="0.00"
        />
      </label>
      <fieldset className="space-y-3 rounded border border-zinc-700/80 bg-zinc-900/30 p-3">
        <legend className="px-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          G/S Fee
        </legend>
        <label className="block max-w-[10rem] text-[11px] text-zinc-500">
          COGS (Printify Item, Shipping)
          <input
            type="text"
            inputMode="decimal"
            value={goodsServicesCostDollars}
            onChange={(e) => onChangeGoodsServicesCostDollars(e.target.value)}
            className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-sm text-zinc-100"
            placeholder="0.00"
          />
        </label>
        <label className="block max-w-[10rem] text-[11px] text-zinc-500">
          Production fee (USD, optional)
          <input
            type="text"
            inputMode="decimal"
            value={productionFeeDollars}
            onChange={(e) => onChangeProductionFeeDollars(e.target.value)}
            className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-sm text-zinc-100"
            placeholder="0.00"
          />
        </label>
      </fieldset>
      <AdminCatalogPrintAreaFields
        embedded
        printAreaWidthPx={printAreaWidthPx}
        printAreaHeightPx={printAreaHeightPx}
        minArtworkDpi={minArtworkDpi}
        onChangePrintAreaWidthPx={onChangePrintAreaWidthPx}
        onChangePrintAreaHeightPx={onChangePrintAreaHeightPx}
        onChangeMinArtworkDpi={onChangeMinArtworkDpi}
      />
    </div>
  );
}
