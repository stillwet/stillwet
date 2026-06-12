"use client";

import { useEffect, useState } from "react";
import {
  MOBILE_TEST_VIEWPORT_HEIGHT_PX,
  MOBILE_TEST_VIEWPORT_WIDTH_PX,
  isMobileTestPreviewFrame,
  readMobileTestViewportEnabled,
} from "@/lib/mobile-test-viewport";

/**
 * Desktop browsers ignore fixed viewport meta widths. When mobile test is on,
 * show a 360px-wide iframe so layout + Tailwind breakpoints match a real phone.
 */
export function MobileTestViewportShell() {
  const [frameSrc, setFrameSrc] = useState<string | null>(null);

  useEffect(() => {
    if (isMobileTestPreviewFrame()) return;

    let alive = true;

    async function maybeShowShell() {
      if (!readMobileTestViewportEnabled()) return;

      try {
        const res = await fetch("/api/header-state", { credentials: "same-origin" });
        const data = res.ok ? ((await res.json()) as { adminLoggedIn?: boolean }) : null;
        if (!alive || data?.adminLoggedIn !== true) return;
        setFrameSrc(window.location.href);
      } catch {
        // Offline — skip shell.
      }
    }

    void maybeShowShell();
    return () => {
      alive = false;
    };
  }, []);

  if (!frameSrc) return null;

  return (
    <div
      className="mobile-test-viewport-shell fixed inset-0 z-[10000] flex items-start justify-center overflow-hidden bg-zinc-950/90 px-4 pt-6 pb-4 backdrop-blur-sm"
      aria-hidden={false}
      role="presentation"
    >
      <div className="flex max-h-full flex-col items-center gap-3">
        <div
          className="overflow-hidden rounded-[1.75rem] border-[3px] border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/60"
          style={{
            width: MOBILE_TEST_VIEWPORT_WIDTH_PX,
            height: `min(${MOBILE_TEST_VIEWPORT_HEIGHT_PX}px, calc(100dvh - 5rem))`,
          }}
        >
          <iframe
            title="Mobile test preview"
            src={frameSrc}
            className="h-full w-full border-0 bg-zinc-950"
          />
        </div>
        <p className="text-center text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          {MOBILE_TEST_VIEWPORT_WIDTH_PX}px preview · use Mobile Test to exit
        </p>
      </div>
    </div>
  );
}
