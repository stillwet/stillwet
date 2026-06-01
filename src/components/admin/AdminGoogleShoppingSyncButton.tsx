"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminRunGoogleMerchantSync } from "@/actions/admin-google-shopping";

export function AdminGoogleShoppingSyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSync() {
    setError(null);
    setMessage(null);
    if (busy) return;
    setBusy(true);
    try {
      const result = await adminRunGoogleMerchantSync();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        `Processed ${result.processed}: ${result.insertedOrUpdated} upserted, ${result.removed} removed, ${result.unchanged} unchanged, ${result.errors} errors.`,
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={onSync}
        className="rounded border border-violet-700/60 bg-violet-950/40 px-3 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-900/50 disabled:opacity-50"
      >
        {busy ? "Syncing…" : "Sync to Merchant Center"}
      </button>
      {message ? <p className="text-xs text-emerald-300/90">{message}</p> : null}
      {error ? <p className="text-xs text-red-300/90">{error}</p> : null}
    </div>
  );
}

function syncStatusClass(status: string): string {
  switch (status) {
    case "synced":
      return "text-emerald-400/90";
    case "pending":
      return "text-zinc-400";
    case "error":
      return "text-red-300/90";
    case "removed":
      return "text-amber-400/80";
    default:
      return "text-zinc-400";
  }
}

export function formatGmcSyncStatusLabel(status: string): string {
  switch (status) {
    case "synced":
      return "Synced";
    case "pending":
      return "Pending";
    case "error":
      return "Error";
    case "removed":
      return "Removed";
    default:
      return status;
  }
}

export function GmcSyncStatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-medium ${syncStatusClass(status)}`}>
      {formatGmcSyncStatusLabel(status)}
    </span>
  );
}
