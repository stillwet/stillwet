"use client";

import type {
  CatalogArtworkTemplatePresetId,
  CatalogCanvasPresentationPresetId,
} from "@/lib/admin-catalog-canvas-presentation";
import { catalogArtworkTemplatePresetFromJson } from "@/lib/admin-catalog-canvas-presentation";

export type { CatalogArtworkTemplatePresetId };

const PRESET_OPTIONS: { id: CatalogCanvasPresentationPresetId; label: string }[] = [
  { id: "flat", label: "None (flat canvas)" },
  { id: "wraparound_mug_3view", label: "Wraparound mug (3 views)" },
  { id: "shape_outline_tee", label: "T-shirt outline (preview)" },
];

const TEMPLATE_PRESET_OPTIONS: { id: CatalogArtworkTemplatePresetId; label: string }[] = [
  { id: "none", label: "Single surface" },
  { id: "dual_sided", label: "Front + optional back" },
];

export function AdminCatalogCanvasPresentationFields({
  canvasPresentationPreset,
  artworkTemplatePreset,
  onChangeCanvasPresentationPreset,
  onChangeArtworkTemplatePreset,
}: {
  canvasPresentationPreset: CatalogCanvasPresentationPresetId;
  artworkTemplatePreset: CatalogArtworkTemplatePresetId;
  onChangeCanvasPresentationPreset: (v: CatalogCanvasPresentationPresetId) => void;
  onChangeArtworkTemplatePreset: (v: CatalogArtworkTemplatePresetId) => void;
}) {
  return (
    <div className="mt-4 space-y-3 rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        Canvas presentation (shop owner preview)
      </p>
      <label className="block text-xs text-zinc-400">
        <span className="mb-1 block text-zinc-500">Visual guides on crop canvas</span>
        <select
          value={canvasPresentationPreset}
          onChange={(e) =>
            onChangeCanvasPresentationPreset(e.target.value as CatalogCanvasPresentationPresetId)
          }
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200"
        >
          {PRESET_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-zinc-400">
        <span className="mb-1 block text-zinc-500">Print surfaces</span>
        <select
          value={artworkTemplatePreset}
          onChange={(e) =>
            onChangeArtworkTemplatePreset(e.target.value as CatalogArtworkTemplatePresetId)
          }
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200"
        >
          {TEMPLATE_PRESET_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[11px] leading-snug text-zinc-600">
        Guides and mug previews are UI-only. Crop/export uses the full print file ({`width × height`} above);
        the dashed inner box is the recommended safe zone for important artwork.
      </p>
    </div>
  );
}

export { catalogArtworkTemplatePresetFromJson };