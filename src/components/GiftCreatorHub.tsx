"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GiftExistingShopForm } from "@/components/GiftExistingShopForm";
import { GiftShopSetupForm } from "@/components/GiftShopSetupForm";

export type GiftCreatorMode = "hub" | "setup" | "existing";

function modeFromParam(raw: string | null): GiftCreatorMode {
  if (raw === "setup" || raw === "existing") return raw;
  return "hub";
}

export function GiftCreatorHub() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<GiftCreatorMode>(() =>
    modeFromParam(searchParams.get("mode")),
  );

  useEffect(() => {
    setMode(modeFromParam(searchParams.get("mode")));
  }, [searchParams]);

  const goHub = useCallback(() => {
    setMode("hub");
    const url = new URL(window.location.href);
    url.searchParams.delete("mode");
    url.searchParams.delete("gift");
    window.history.replaceState(null, "", url.pathname + url.search);
  }, []);

  const goMode = useCallback((next: "setup" | "existing") => {
    setMode(next);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", next);
    url.searchParams.delete("gift");
    window.history.replaceState(null, "", url.pathname + url.search);
  }, []);

  if (mode === "setup") {
    return <GiftShopSetupForm onBack={goHub} />;
  }

  if (mode === "existing") {
    return <GiftExistingShopForm onBack={goHub} />;
  }

  return (
    <div className="mt-8 space-y-3">
      <p className="text-sm leading-relaxed text-zinc-400">
        Choose how you&apos;d like to gift a creator on Still Wet.
      </p>

      <button
        type="button"
        onClick={() => goMode("setup")}
        className="flex w-full flex-col rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-left transition hover:border-zinc-600 hover:bg-zinc-900/50"
      >
        <span className="text-sm font-medium text-zinc-100">Gift a shop setup</span>
        <span className="mt-1 text-xs leading-relaxed text-zinc-500">
          Gift someone a shop setup fee.
        </span>
      </button>

      <button
        type="button"
        onClick={() => goMode("existing")}
        className="flex w-full flex-col rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-left transition hover:border-zinc-600 hover:bg-zinc-900/50"
      >
        <span className="text-sm font-medium text-zinc-100">Gifts for existing shops</span>
        <span className="mt-1 text-xs leading-relaxed text-zinc-500">
          Shop upgrade options.
        </span>
      </button>
    </div>
  );
}
