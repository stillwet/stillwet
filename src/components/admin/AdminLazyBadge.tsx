"use client";

import { useEffect, useState } from "react";
import {
  navTabCountBadgeClass,
  navTabCountBadgeMutedClass,
} from "@/lib/nav-tab-count-badge";

type LazyBadgeVariant = "pill" | "muted";

function classForVariant(variant: LazyBadgeVariant, count: number): string {
  return variant === "pill"
    ? navTabCountBadgeClass(count)
    : navTabCountBadgeMutedClass(count);
}

/**
 * Renders a tab nav badge whose count is fetched client-side via a server action AFTER the
 * page paints. Use for heavy/non-critical badges so the admin page (and its server-action
 * revalidation responses) never block on the slowest count query.
 *
 * If the page already knows the value (the user is viewing the tab whose data was loaded
 * synchronously), pass it as `initialCount` — the badge renders immediately with no fetch.
 */
export function AdminLazyBadge(props: {
  /** Server action that returns the up-to-date count. Re-run on mount when no `initialCount`. */
  fetchAction: () => Promise<number>;
  /** `pill` (blue pill at non-zero) or `muted` (inherits tab text color). */
  variant: LazyBadgeVariant;
  /** When provided, badge renders this immediately and does NOT call `fetchAction`. */
  initialCount?: number | null;
}) {
  const [count, setCount] = useState<number | null>(
    props.initialCount ?? null,
  );

  useEffect(() => {
    if (props.initialCount != null) return;
    let cancelled = false;
    props.fetchAction().then(
      (n) => {
        if (!cancelled) setCount(n);
      },
      (err) => {
        if (!cancelled) {
          console.error("[AdminLazyBadge] fetchAction failed", err);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [props]);

  if (count == null) {
    return <span className={classForVariant(props.variant, 0)}>(…)</span>;
  }
  return (
    <span className={classForVariant(props.variant, count)}>({count})</span>
  );
}
