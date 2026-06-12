"use client";

import { useEffect, useState } from "react";
import { MobileTestViewportToggle } from "@/components/MobileTestViewportToggle";

export function SiteBetaBanner() {
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);

  useEffect(() => {
    let alive = true;

    async function refreshAdminState() {
      try {
        const res = await fetch("/api/header-state", { credentials: "same-origin" });
        const data = res.ok ? ((await res.json()) as { adminLoggedIn?: boolean }) : null;
        if (!alive) return;
        setAdminLoggedIn(data?.adminLoggedIn === true);
      } catch {
        // Offline — keep hidden.
      }
    }

    void refreshAdminState();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div
      role="status"
      className="relative z-[1000] border-b border-blue-900/40 bg-[#0e1325] px-4 py-2 text-[11px] leading-snug tracking-wide text-blue-200/90 sm:text-xs"
    >
      <div className="relative mx-auto flex max-w-[1124px] items-center">
        <div className="relative z-10 shrink-0">
          {adminLoggedIn ? <MobileTestViewportToggle /> : null}
        </div>
        <p className="pointer-events-none absolute inset-x-0 text-center">
          Website is currently in beta testing. No item sales are available at this time.
        </p>
      </div>
    </div>
  );
}
