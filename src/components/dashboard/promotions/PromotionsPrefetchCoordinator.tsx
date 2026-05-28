"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DASHBOARD_PROMOTIONS_PATH } from "@/lib/dashboard-promotions-path";
import {
  isPromotionsPrefetchSkippedPath,
  prefetchPromotionOptionalChunks,
  shouldBackgroundPrefetchPromotions,
} from "@/lib/promotions-background-prefetch";

const IDLE_TIMEOUT_MS = 4000;
const CHUNK_IDLE_TIMEOUT_MS = 8000;

/**
 * After the active dashboard page is idle, prefetch shop upgrades (RSC) then optional JS chunks.
 * Cancels and reschedules on navigation so the visible route stays first.
 */
export function PromotionsPrefetchCoordinator() {
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const routeIdleIdRef = useRef<number | null>(null);
  const routeTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chunkIdleIdRef = useRef<number | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    const gen = ++generationRef.current;

    const clearScheduled = () => {
      if (routeIdleIdRef.current != null) {
        cancelIdleCallback(routeIdleIdRef.current);
        routeIdleIdRef.current = null;
      }
      if (routeTimeoutIdRef.current != null) {
        clearTimeout(routeTimeoutIdRef.current);
        routeTimeoutIdRef.current = null;
      }
      if (chunkIdleIdRef.current != null) {
        cancelIdleCallback(chunkIdleIdRef.current);
        chunkIdleIdRef.current = null;
      }
    };

    clearScheduled();

    if (!shouldBackgroundPrefetchPromotions()) return () => clearScheduled;

    const onPromotionsPage = pathname.startsWith(DASHBOARD_PROMOTIONS_PATH);

    if (isPromotionsPrefetchSkippedPath(pathname) && !onPromotionsPage) {
      return () => clearScheduled;
    }

    const scheduleChunks = () => {
      if (generationRef.current !== gen) return;
      const path = pathnameRef.current;
      if (path.startsWith("/dashboard/login")) return;

      const runChunks = () => {
        if (generationRef.current !== gen) return;
        if (pathnameRef.current.startsWith("/dashboard/login")) return;
        prefetchPromotionOptionalChunks();
      };

      if ("requestIdleCallback" in window) {
        chunkIdleIdRef.current = requestIdleCallback(runChunks, { timeout: CHUNK_IDLE_TIMEOUT_MS });
      } else {
        setTimeout(runChunks, 1200);
      }
    };

    const runRoutePrefetch = () => {
      if (generationRef.current !== gen) return;
      if (pathnameRef.current.startsWith(DASHBOARD_PROMOTIONS_PATH)) {
        scheduleChunks();
        return;
      }
      if (isPromotionsPrefetchSkippedPath(pathnameRef.current)) return;
      router.prefetch(DASHBOARD_PROMOTIONS_PATH);
      scheduleChunks();
    };

    if ("requestIdleCallback" in window) {
      routeIdleIdRef.current = requestIdleCallback(runRoutePrefetch, { timeout: IDLE_TIMEOUT_MS });
    } else {
      routeTimeoutIdRef.current = setTimeout(runRoutePrefetch, 800);
    }

    return clearScheduled;
  }, [pathname, router]);

  return null;
}
