"use client";

import { PRINT_AREA_REFERENCE_DPI } from "@/lib/listing-artwork-print-area";

import { LISTING_REQUEST_ARTWORK_LARGE_MAX_MB } from "@/lib/listing-request-artwork-limits";

/** Per catalog item: optional print-area pixels, optional min DPI vs. reference, plus note for creators. */
export function AdminCatalogArtworkRequirementFields({
  imageRequirementLabel,
  printAreaWidthPx,
  printAreaHeightPx,
  minArtworkDpi,
  largeListingArtwork,
  onChangeImageRequirementLabel,
  onChangePrintAreaWidthPx,
  onChangePrintAreaHeightPx,
  onChangeMinArtworkDpi,
  onChangeLargeListingArtwork,
}: {
  imageRequirementLabel: string;
  printAreaWidthPx: string;
  printAreaHeightPx: string;
  minArtworkDpi: string;
  largeListingArtwork: boolean;
  onChangeImageRequirementLabel: (v: string) => void;
  onChangePrintAreaWidthPx: (v: string) => void;
  onChangePrintAreaHeightPx: (v: string) => void;
  onChangeMinArtworkDpi: (v: string) => void;
  onChangeLargeListingArtwork: (v: boolean) => void;
}) {
  return (
    <div className="space-y-3 border-t border-zinc-800/80 pt-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Artwork / resolution</p>
      <label className="block text-xs text-zinc-500">
        Requirement note (optional)
        <input
          type="text"
          value={imageRequirementLabel}
          onChange={(e) => onChangeImageRequirementLabel(e.target.value)}
          maxLength={400}
          placeholder='e.g. 12" print @ 300 DPI'
          className="mt-1 block w-full max-w-xl rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
        />
      </label>
      <div className="flex flex-wrap gap-4">
        <label className="block text-xs text-zinc-500">
          Print area width (px)
          <input
            type="text"
            inputMode="numeric"
            value={printAreaWidthPx}
            onChange={(e) => onChangePrintAreaWidthPx(e.target.value)}
            placeholder="e.g. 4500 — blank with height"
            className="mt-1 block w-full min-w-[10rem] max-w-xs rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-sm text-zinc-100"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          Print area height (px)
          <input
            type="text"
            inputMode="numeric"
            value={printAreaHeightPx}
            onChange={(e) => onChangePrintAreaHeightPx(e.target.value)}
            placeholder="e.g. 5400"
            className="mt-1 block w-full min-w-[10rem] max-w-xs rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-sm text-zinc-100"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          Minimum DPI (optional)
          <input
            type="text"
            inputMode="numeric"
            value={minArtworkDpi}
            onChange={(e) => onChangeMinArtworkDpi(e.target.value)}
            placeholder={`blank = ${PRINT_AREA_REFERENCE_DPI}`}
            className="mt-1 block w-full min-w-[10rem] max-w-xs rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-sm text-zinc-100"
          />
        </label>
      </div>
      <label className="flex cursor-pointer items-start gap-2 text-xs text-zinc-400">
        <input
          type="checkbox"
          name="itemLargeListingArtwork"
          value="1"
          checked={largeListingArtwork}
          onChange={(e) => onChangeLargeListingArtwork(e.target.checked)}
          className="mt-0.5 rounded border-zinc-600 bg-zinc-900"
        />
        <span>
          Allow large listing artwork uploads (up to {LISTING_REQUEST_ARTWORK_LARGE_MAX_MB} MB). Default
          catalog items are limited to 15 MB.
        </span>
      </label>
    </div>
  );
}
