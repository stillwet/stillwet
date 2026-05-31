"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Captures scroll before async UI (e.g. prorated pricing) and restores it once loading settles.
 * Use for promotion checkout period picks across Hot item, Featured shop, and Popular item.
 */
export function usePreserveScrollOnSettled(loading: boolean, settled: boolean) {
  const scrollYRef = useRef<number | null>(null);

  const captureScroll = useCallback(() => {
    scrollYRef.current = window.scrollY;
  }, []);

  useEffect(() => {
    if (scrollYRef.current == null) return;
    if (loading || !settled) return;
    const y = scrollYRef.current;
    scrollYRef.current = null;
    requestAnimationFrame(() => {
      window.scrollTo(0, y);
    });
  }, [loading, settled]);

  return captureScroll;
}
