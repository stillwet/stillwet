"use client";

import { useId } from "react";
import type { PillowSidesArtworkMode } from "@/lib/listing-artwork-pillow-listing";

export function ListingPillowDoubleSidedFields({
  doubleSided,
  sidesMode,
  adminDualSidedLocked,
  disabled,
  onDoubleSidedChange,
  onSidesModeChange,
}: {
  doubleSided: boolean;
  sidesMode: PillowSidesArtworkMode;
  /** Catalog template already defines front + back surfaces. */
  adminDualSidedLocked: boolean;
  disabled?: boolean;
  onDoubleSidedChange: (next: boolean) => void;
  onSidesModeChange: (next: PillowSidesArtworkMode) => void;
}) {
  const sidesModeGroupName = useId();

  return (
    <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2.5">
      <label className="flex cursor-pointer items-start gap-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          checked={doubleSided}
          disabled={disabled || adminDualSidedLocked}
          onChange={(e) => onDoubleSidedChange(e.target.checked)}
          className="mt-0.5 rounded border-zinc-600 bg-zinc-900"
        />
        <span>
          Double sided
          {adminDualSidedLocked ? (
            <span className="mt-0.5 block text-[11px] text-zinc-500">
              This catalog item includes a back print surface.
            </span>
          ) : null}
        </span>
      </label>
      {doubleSided ? (
        <div className="space-y-1.5 pl-6">
          <fieldset className="space-y-1.5" disabled={disabled}>
            <div className="space-y-1.5" role="radiogroup" aria-label="Artwork for each side">
              <label className="flex cursor-pointer items-start gap-2 text-xs text-zinc-300">
                <input
                  type="radio"
                  name={sidesModeGroupName}
                  checked={sidesMode === "same"}
                  onChange={() => onSidesModeChange("same")}
                  className="mt-0.5 shrink-0 border-zinc-600 bg-zinc-900 text-blue-600"
                />
                <span>Same front / back</span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-xs text-zinc-300">
                <input
                  type="radio"
                  name={sidesModeGroupName}
                  checked={sidesMode === "different"}
                  onChange={() => onSidesModeChange("different")}
                  className="mt-0.5 shrink-0 border-zinc-600 bg-zinc-900 text-blue-600"
                />
                <span>Different front / back</span>
              </label>
            </div>
          </fieldset>
        </div>
      ) : null}
    </div>
  );
}
