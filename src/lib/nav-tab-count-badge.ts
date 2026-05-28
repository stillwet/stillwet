const navTabCountBadgeNonZeroCore =
  "inline-flex shrink-0 items-center justify-center tabular-nums font-medium text-blue-300 bg-blue-950/85 ring-1 ring-blue-800/55";

/** Blue pill for non-zero tab counts (pair with `gap-*` on parent; no left margin). */
export const navTabCountBadgePillClass =
  `${navTabCountBadgeNonZeroCore} min-w-[1.65rem] rounded-md px-1.5 py-0.5`;

/**
 * Circular / stadium badge for compact numeric counts (e.g. dashboard notifications unread).
 * `min-w` grows for multi-digit counts while staying vertically round.
 */
export const navTabCountBadgeCircleClass =
  `${navTabCountBadgeNonZeroCore} h-6 min-w-[1.5rem] rounded-full px-1.5`;

/**
 * Muted at zero; blue pill when the count is greater than zero. Includes `ml-1.5` for use after tab label text.
 */
export function navTabCountBadgeClass(count: number): string {
  if (count <= 0) return "ml-1.5 tabular-nums text-zinc-500";
  return `ml-1.5 ${navTabCountBadgePillClass}`;
}

/**
 * Same spacing as {@link navTabCountBadgeClass} but no blue pill — inherits the tab label color
 * (inactive vs active) with a light fade.
 */
export function navTabCountBadgeMutedClass(_count: number): string {
  return "ml-1.5 tabular-nums text-inherit opacity-60";
}
