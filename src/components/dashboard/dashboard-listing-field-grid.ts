/**
 * Listing card expanded fields: primary column grows; save column is content-sized (“Save” / “Saving…” / “Saved”).
 */
export const LISTING_FIELD_SAVE_ROW =
  "grid w-full min-w-0 grid-cols-1 gap-x-2 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end";

/** Same grid as {@link LISTING_FIELD_SAVE_ROW} but vertically centers the save column with the control row (e.g. multiline pitch). */
export const LISTING_FIELD_SAVE_ROW_CENTER =
  "grid w-full min-w-0 grid-cols-1 gap-x-2 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center";

/** ~86px square — matches embedded catalog picker cells for aligned preview rows. */
export const LISTING_EMBEDDED_PREVIEW_FRAME =
  "block size-[5.375rem] shrink-0 overflow-hidden rounded-lg border border-zinc-700/90 bg-zinc-900/40";

/** Width for actions aligned under embedded thumbs (same as {@link LISTING_EMBEDDED_PREVIEW_FRAME}). */
export const LISTING_EMBEDDED_THUMB_CONTROL =
  "w-[5.375rem] shrink-0 text-center";

export const LISTING_EMBEDDED_PREVIEW_FRAME_SELECTABLE =
  `${LISTING_EMBEDDED_PREVIEW_FRAME} ring-2 ring-transparent ring-offset-2 ring-offset-zinc-950 transition peer-focus-visible:ring-blue-400/60 peer-checked:border-blue-600/50 peer-checked:ring-blue-500/75`;

export const LISTING_EMBEDDED_PREVIEW_IMG =
  "aspect-square h-full w-full object-cover transition group-hover:opacity-90";

/** Empty slot matching {@link LISTING_EMBEDDED_PREVIEW_FRAME} size (side-by-side with catalog picks). */
export const LISTING_EMBEDDED_PREVIEW_PLACEHOLDER =
  "block size-[5.375rem] shrink-0 rounded-lg border border-dashed border-zinc-600/45 bg-zinc-900/20";

/** Empty slot matching the standalone 80×80 custom image preview. */
export const LISTING_SUPPLEMENT_PREVIEW_PLACEHOLDER =
  "h-20 w-20 shrink-0 rounded-lg border border-dashed border-zinc-600/45 bg-zinc-900/20";

export const LISTING_FIELD_SAVE_PRIMARY = "min-w-0";

/** Right-align on stacked layout; autosave status / legacy controls in the `auto` column on `sm+`. */
export const LISTING_FIELD_SAVE_ACTION =
  "flex w-full min-w-0 justify-end sm:block sm:w-auto sm:shrink-0 sm:justify-self-end [&>button]:shrink-0 [&>span]:shrink-0";
