"use client";

import { useMemo } from "react";
import { PRINT_AREA_REFERENCE_DPI } from "@/lib/listing-artwork-print-area";
import {
  type ListingArtworkLetterboxFill,
} from "@/lib/listing-artwork-letterbox-fill";
import { ListingArtworkLetterboxFill as ListingArtworkLetterboxFillEnum } from "@/generated/prisma/enums";
import { AdminCatalogItemArtworkSourceTierOverride } from "@/generated/prisma/enums";
import {
  CATALOG_ARTWORK_SOURCE_TIER_LABELS,
  computedCatalogArtworkSourceTier,
  parseCatalogArtworkSourceTierOverride,
  referencePhoneEffectiveDpiForPrint,
  type CatalogArtworkSourceTierOverride,
} from "@/lib/listing-artwork-source-tier";

/** Per catalog item: optional print-area pixels, optional min DPI vs. reference, plus note for creators. */
export function AdminCatalogArtworkRequirementFields({
  imageRequirementLabel,
  printAreaWidthPx,
  printAreaHeightPx,
  minArtworkDpi,
  artworkLetterboxFill,
  artworkSourceTierOverride,
  onChangeImageRequirementLabel,
  onChangePrintAreaWidthPx,
  onChangePrintAreaHeightPx,
  onChangeMinArtworkDpi,
  onChangeArtworkLetterboxFill,
  onChangeArtworkSourceTierOverride,
}: {
  imageRequirementLabel: string;
  printAreaWidthPx: string;
  printAreaHeightPx: string;
  minArtworkDpi: string;
  artworkLetterboxFill: ListingArtworkLetterboxFill;
  artworkSourceTierOverride: CatalogArtworkSourceTierOverride;
  onChangeImageRequirementLabel: (v: string) => void;
  onChangePrintAreaWidthPx: (v: string) => void;
  onChangePrintAreaHeightPx: (v: string) => void;
  onChangeMinArtworkDpi: (v: string) => void;
  onChangeArtworkLetterboxFill: (v: ListingArtworkLetterboxFill) => void;
  onChangeArtworkSourceTierOverride: (v: CatalogArtworkSourceTierOverride) => void;
}) {
  const computedTierPreview = useMemo(() => {
    const w = parseInt(printAreaWidthPx.trim(), 10);
    const h = parseInt(printAreaHeightPx.trim(), 10);
    const printW = Number.isFinite(w) && w > 0 ? w : null;
    const printH = Number.isFinite(h) && h > 0 ? h : null;
    const tier = computedCatalogArtworkSourceTier(printW, printH);
    const refDpi =
      printW != null && printH != null ? referencePhoneEffectiveDpiForPrint(printW, printH) : null;
    return { tier, refDpi, hasPrint: printW != null && printH != null };
  }, [printAreaWidthPx, printAreaHeightPx]);

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
        <span className="mt-1 block text-[11px] text-zinc-600">
          Shown to creators when they select this item in the listing request form.
        </span>
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
      <label className="block text-xs text-zinc-500">
        Artwork source tier (shop picker)
        <select
          value={artworkSourceTierOverride}
          onChange={(e) =>
            onChangeArtworkSourceTierOverride(
              parseCatalogArtworkSourceTierOverride(e.target.value),
            )
          }
          className="mt-1 block w-full max-w-md rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
        >
          <option value={AdminCatalogItemArtworkSourceTierOverride.auto}>
            Auto (from print area)
          </option>
          <option value={AdminCatalogItemArtworkSourceTierOverride.phone_pic_safe}>
            Phone pic safe
          </option>
          <option value={AdminCatalogItemArtworkSourceTierOverride.camera_or_vector_only}>
            Camera / vector only
          </option>
        </select>
        <span className="mt-1 block text-[11px] text-zinc-600">
          {artworkSourceTierOverride === AdminCatalogItemArtworkSourceTierOverride.auto ? (
            computedTierPreview.hasPrint ? (
              <>
                Auto classifies as{" "}
                <strong className="font-medium text-zinc-500">
                  {CATALOG_ARTWORK_SOURCE_TIER_LABELS[computedTierPreview.tier]}
                </strong>
                {computedTierPreview.refDpi != null
                  ? ` (~${Math.round(computedTierPreview.refDpi)} DPI from a reference phone photo).`
                  : "."}
              </>
            ) : (
              "Set print area width and height to preview auto classification (defaults to Phone pic safe)."
            )
          ) : (
            "Override replaces auto classification in the shop catalog picker."
          )}
        </span>
      </label>
      <label className="block text-xs text-zinc-500">
        Letterbox margin (zoomed-out crop)
        <select
          value={artworkLetterboxFill}
          onChange={(e) => onChangeArtworkLetterboxFill(e.target.value as ListingArtworkLetterboxFill)}
          className="mt-1 block w-full max-w-xs rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
        >
          <option value={ListingArtworkLetterboxFillEnum.transparent}>Transparent (mugs, apparel)</option>
          <option value={ListingArtworkLetterboxFillEnum.white}>White (canvas, paper, poster)</option>
        </select>
        <span className="mt-1 block text-[11px] text-zinc-600">
          Empty margin in the final print file. White compresses better and matches physical substrate.
        </span>
      </label>
    </div>
  );
}
