"use client";

import { useEffect } from "react";
import {
  isMobileTestPreviewFrame,
  readMobileTestViewportEnabled,
  syncMobileTestViewportForAdmin,
} from "@/lib/mobile-test-viewport";

/** Re-applies persisted mobile test viewport only for active admin sessions. */
export function MobileTestViewportSync() {
  useEffect(() => {
    let alive = true;

    async function sync() {
      try {
        const res = await fetch("/api/header-state", { credentials: "same-origin" });
        const data = res.ok ? ((await res.json()) as { adminLoggedIn?: boolean }) : null;
        if (!alive) return;
        const adminLoggedIn = data?.adminLoggedIn === true;
        syncMobileTestViewportForAdmin(adminLoggedIn);

        if (
          isMobileTestPreviewFrame() &&
          adminLoggedIn &&
          readMobileTestViewportEnabled()
        ) {
          document.documentElement.classList.add("mobile-test-viewport-frame");
        }
      } catch {
        if (!alive) return;
        syncMobileTestViewportForAdmin(false);
      }
    }

    void sync();
    return () => {
      alive = false;
    };
  }, []);

  return null;
}
