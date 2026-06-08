import type { CSSProperties } from "react";
import { PRINT_AREA_REFERENCE_DPI } from "@/lib/listing-artwork-print-area";

/** Stretched canvas wrap depth shown in the crop preview (approx. standard gallery wrap). */
export const CANVAS_WRAP_BLEED_INCHES = 1.25;

/** Darkened wrap band on the crop box in the listing artwork preview (visual only). */
export const CANVAS_WRAP_PREVIEW_EDGE_INSET_PX = 20;

/** Semi-transparent dimming for image-on-sides wrap preview (artwork still visible underneath). */
export const CANVAS_WRAP_BLEED_OVERLAY_FILL = "rgba(0, 0, 0, 0.55)";

/** @deprecated Use {@link canvasWrapBleedPreviewFill} — image-on-sides uses overlay fill, not solid black. */
export const CANVAS_WRAP_BLEED_MARGIN_FILL = "#000000";

export function canvasWrapBleedPreviewFill(
  sideTreatment: "image" | "solid",
  solidSideColorHex: string,
): string {
  if (sideTreatment === "solid") {
    return canvasSolidSideHexOrDefault(solidSideColorHex);
  }
  return CANVAS_WRAP_BLEED_OVERLAY_FILL;
}

/** CSS vars for `.listing-artwork-crop-canvas-wrap-preview` (inset edge darkening on the crop box). */
export function canvasWrapBleedPreviewStyleVars(
  sideTreatment: "image" | "solid",
  solidSideColorHex: string,
  hostWidth?: number,
  hostHeight?: number,
): CSSProperties {
  let insetPx = CANVAS_WRAP_PREVIEW_EDGE_INSET_PX;
  if (hostWidth != null && hostHeight != null && hostWidth > 0 && hostHeight > 0) {
    const maxInset = Math.floor(Math.min(hostWidth, hostHeight) / 2) - 1;
    if (maxInset > 0) {
      insetPx = Math.min(insetPx, maxInset);
    }
  }
  return {
    ["--listing-artwork-canvas-wrap-inset" as string]: `${insetPx}px`,
    ["--listing-artwork-canvas-wrap-edge-fill" as string]: canvasWrapBleedPreviewFill(
      sideTreatment,
      solidSideColorHex,
    ),
  };
}

/** Default wrap color when solid sides is selected. */
export const CANVAS_SOLID_SIDE_DEFAULT_HEX = "#000000";

export const CANVAS_SOLID_SIDE_BLACK_HEX = "#000000";
export const CANVAS_SOLID_SIDE_WHITE_HEX = "#ffffff";

export const CANVAS_SOLID_SIDE_PRESET_HEX = {
  black: CANVAS_SOLID_SIDE_BLACK_HEX,
  white: CANVAS_SOLID_SIDE_WHITE_HEX,
} as const;

export type CanvasSolidSidePreset = keyof typeof CANVAS_SOLID_SIDE_PRESET_HEX;

export function canvasSolidSidePresetForHex(hex: string): CanvasSolidSidePreset | null {
  const parsed = parseCanvasSolidSideHex(hex);
  if (parsed === CANVAS_SOLID_SIDE_BLACK_HEX) return "black";
  if (parsed === CANVAS_SOLID_SIDE_WHITE_HEX) return "white";
  return null;
}

const CANVAS_SOLID_SIDE_HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Parse #RGB or #RRGGBB (hash optional). Returns normalized lowercase #rrggbb. */
export function parseCanvasSolidSideHex(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  if (!CANVAS_SOLID_SIDE_HEX_RE.test(withHash)) return null;
  if (withHash.length === 4) {
    const r = withHash[1]!;
    const g = withHash[2]!;
    const b = withHash[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return withHash.toLowerCase();
}

export function canvasSolidSideHexOrDefault(input: string): string {
  return parseCanvasSolidSideHex(input) ?? CANVAS_SOLID_SIDE_DEFAULT_HEX;
}

/**
 * Edge inset as a fraction of the crop preview, assuming print template pixels are at reference DPI.
 * Example: 12×9 in at 300 DPI → ~10.4% horizontal / ~13.9% vertical for 1.25 in wrap.
 */
export function canvasWrapBleedInsetFractions(
  printWidthPx: number,
  printHeightPx: number,
  referenceDpi: number = PRINT_AREA_REFERENCE_DPI,
): { insetX: number; insetY: number } {
  const ref = referenceDpi > 0 ? referenceDpi : PRINT_AREA_REFERENCE_DPI;
  const widthIn = printWidthPx / ref;
  const heightIn = printHeightPx / ref;
  if (!(widthIn > 0) || !(heightIn > 0)) {
    return { insetX: 0, insetY: 0 };
  }
  const insetX = CANVAS_WRAP_BLEED_INCHES / widthIn;
  const insetY = CANVAS_WRAP_BLEED_INCHES / heightIn;
  return {
    insetX: Math.min(Math.max(insetX, 0), 0.49),
    insetY: Math.min(Math.max(insetY, 0), 0.49),
  };
}

/** Pixel insets for each edge — equal physical thickness when crop aspect matches print. */
export function canvasWrapBleedInsetPx(
  hostWidth: number,
  hostHeight: number,
  printWidthPx: number,
  printHeightPx: number,
): { insetXPx: number; insetYPx: number } {
  const { insetX, insetY } = canvasWrapBleedInsetFractions(printWidthPx, printHeightPx);
  return {
    insetXPx: hostWidth * insetX,
    insetYPx: hostHeight * insetY,
  };
}

/** @deprecated Use {@link canvasWrapBleedInsetPx} — uniform max inset skews landscape canvases. */
export function canvasWrapBleedCssVarsForHost(
  hostWidth: number,
  hostHeight: number,
  printWidthPx: number,
  printHeightPx: number,
): Record<"--listing-artwork-canvas-bleed-inset", string> {
  const { insetXPx, insetYPx } = canvasWrapBleedInsetPx(
    hostWidth,
    hostHeight,
    printWidthPx,
    printHeightPx,
  );
  return {
    "--listing-artwork-canvas-bleed-inset": `${Math.max(insetXPx, insetYPx)}px`,
  };
}
