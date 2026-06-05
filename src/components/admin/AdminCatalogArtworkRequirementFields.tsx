"use client";

import { PRINT_AREA_REFERENCE_DPI } from "@/lib/listing-artwork-print-area";
import {
  type ListingArtworkLetterboxFill,
} from "@/lib/listing-artwork-letterbox-fill";
import { ListingArtworkLetterboxFill as ListingArtworkLetterboxFillEnum } from "@/generated/prisma/enums";

/** Per catalog item: optional print-area pixels, optional min DPI vs. reference, plus note for creators. */
export function AdminCatalogArtworkRequirementFields({
  imageRequirementLabel,
  printAreaWidthPx,
  printAreaHeightPx,
  minArtworkDpi,
  artworkLetterboxFill,
  onChangeImageRequirementLabel,
  onChangePrintAreaWidthPx,
  onChangePrintAreaHeightPx,
  onChangeMinArtworkDpi,
  onChangeArtworkLetterboxFill,
}: {
  imageRequirementLabel: string;
  printAreaWidthPx: string;
  printAreaHeightPx: string;
  minArtworkDpi: string;
  artworkLetterboxFill: ListingArtworkLetterboxFill;
  onChangeImageRequirementLabel: (v: string) => void;
  onChangePrintAreaWidthPx: (v: string) => void;
  onChangePrintAreaHeightPx: (v: string) => void;
  onChangeMinArtworkDpi: (v: string) => void;
  onChangeArtworkLetterboxFill: (v: ListingArtworkLetterboxFill) => void;
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
