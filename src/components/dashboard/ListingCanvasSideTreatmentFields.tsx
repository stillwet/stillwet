"use client";

import { useId } from "react";
import {
  CANVAS_SOLID_SIDE_DEFAULT_HEX,
  CANVAS_SOLID_SIDE_PRESET_HEX,
  canvasSolidSidePresetForHex,
  parseCanvasSolidSideHex,
} from "@/lib/listing-artwork-canvas-wrap-bleed";

export type CanvasSideTreatment = "image" | "solid";

export function canvasSideTreatmentShowsWrapMarginPreview(treatment: CanvasSideTreatment): boolean {
  return treatment === "image" || treatment === "solid";
}

/** @deprecated Use {@link canvasSideTreatmentShowsWrapMarginPreview}. */
export function canvasSideTreatmentShowsBleedPreview(treatment: CanvasSideTreatment): boolean {
  return treatment === "image";
}

function presetButtonClass(active: boolean, disabled: boolean): string {
  return `rounded-lg border px-2.5 py-1 text-xs disabled:opacity-50 ${
    active
      ? "border-zinc-500 bg-zinc-700 font-medium text-zinc-100"
      : "border-zinc-600 text-zinc-300 hover:bg-zinc-900"
  }`;
}

export function ListingCanvasSideTreatmentFields({
  sideTreatment,
  onSideTreatmentChange,
  solidSideColorHex,
  onSolidSideColorHexChange,
  colorPickActive = false,
  onColorPickActiveChange,
  disabled = false,
}: {
  sideTreatment: CanvasSideTreatment;
  onSideTreatmentChange: (next: CanvasSideTreatment) => void;
  solidSideColorHex: string;
  onSolidSideColorHexChange: (next: string) => void;
  colorPickActive?: boolean;
  onColorPickActiveChange?: (active: boolean) => void;
  disabled?: boolean;
}) {
  const groupName = useId();
  const solidColorInputId = useId();
  const parsedSolidHex = parseCanvasSolidSideHex(solidSideColorHex);
  const swatchColor = parsedSolidHex ?? CANVAS_SOLID_SIDE_DEFAULT_HEX;
  const activePreset = canvasSolidSidePresetForHex(solidSideColorHex);

  function startColorPick() {
    if (disabled) return;
    onColorPickActiveChange?.(true);
  }

  return (
    <div className="space-y-1">
      <fieldset className="min-w-0 border-0 p-0" disabled={disabled}>
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1.5"
          role="radiogroup"
          aria-label="Canvas sides"
        >
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
            <input
              type="radio"
              name={groupName}
              checked={sideTreatment === "image"}
              onChange={() => onSideTreatmentChange("image")}
              className="shrink-0 border-zinc-600 bg-zinc-900 text-blue-600"
            />
            <span>Image on sides</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
            <input
              type="radio"
              name={groupName}
              checked={sideTreatment === "solid"}
              onChange={() => onSideTreatmentChange("solid")}
              className="shrink-0 border-zinc-600 bg-zinc-900 text-blue-600"
            />
            <span>Solid color on sides</span>
          </label>
        </div>
      </fieldset>
      {sideTreatment === "solid" ? (
        <div className="space-y-1.5 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="shrink-0 text-xs text-zinc-400">Side color</span>
            <button
              type="button"
              disabled={disabled}
              aria-pressed={activePreset === "black"}
              onClick={() => onSolidSideColorHexChange(CANVAS_SOLID_SIDE_PRESET_HEX.black)}
              className={presetButtonClass(activePreset === "black", disabled)}
            >
              Black
            </button>
            <button
              type="button"
              disabled={disabled}
              aria-pressed={activePreset === "white"}
              onClick={() => onSolidSideColorHexChange(CANVAS_SOLID_SIDE_PRESET_HEX.white)}
              className={presetButtonClass(activePreset === "white", disabled)}
            >
              White
            </button>
            <span
              className="size-5 shrink-0 rounded border border-zinc-600"
              style={{ backgroundColor: swatchColor }}
              aria-hidden
            />
            <input
              id={solidColorInputId}
              type="text"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              value={solidSideColorHex}
              onChange={(e) => onSolidSideColorHexChange(e.target.value)}
              placeholder="#000000"
              className="w-[6.5rem] rounded border border-zinc-600 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 disabled:opacity-50"
              aria-invalid={solidSideColorHex.trim() !== "" && parsedSolidHex == null}
              aria-label="Custom side color hex"
            />
            {colorPickActive ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onColorPickActiveChange?.(false)}
                className="rounded-lg border border-zinc-600 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
              >
                Cancel pick
              </button>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={startColorPick}
                className="rounded-lg border border-zinc-600 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
              >
                Pick from image
              </button>
            )}
          </div>
          {colorPickActive ? (
            <p className="text-xs leading-snug text-zinc-300" role="status">
              Click the artwork in the crop preview to sample a color.
            </p>
          ) : solidSideColorHex.trim() !== "" && parsedSolidHex == null ? (
            <p className="text-xs text-amber-200/90" role="status">
              Enter a valid hex color (#RGB or #RRGGBB).
            </p>
          ) : (
            <p className="text-xs leading-snug text-zinc-400">
              Only the face uses your artwork; edges use this solid wrap color in the preview.
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs leading-snug text-zinc-400">
          Darkened area approximates the sides of the canvas (1.25 in).
        </p>
      )}
    </div>
  );
}
