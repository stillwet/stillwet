"use client";

import type { CatalogArtworkSurface } from "@/lib/admin-catalog-artwork-template";

export function ListingArtworkSurfaceTabs({
  surfaces,
  activeSurfaceId,
  surfaceArtworkReady,
  onSelect,
}: {
  surfaces: CatalogArtworkSurface[];
  activeSurfaceId: string;
  /** surfaceId → has baked artwork */
  surfaceArtworkReady: Record<string, boolean>;
  onSelect: (surfaceId: string) => void;
}) {
  if (surfaces.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Artwork surfaces">
      {surfaces.map((surface) => {
        const active = surface.id === activeSurfaceId;
        const ready = surfaceArtworkReady[surface.id] === true;
        return (
          <button
            key={surface.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(surface.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              active
                ? "border-zinc-400 bg-zinc-100 text-zinc-900"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
            }`}
          >
            {surface.label}
            {!surface.required ? " (optional)" : ""}
            {ready ? " ✓" : ""}
          </button>
        );
      })}
    </div>
  );
}
