"use client";

import { useState } from "react";
import { adminExportGoogleShoppingEnrollmentsCsv } from "@/actions/admin-google-shopping";

export function AdminGoogleShoppingExportButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onExport() {
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      const result = await adminExportGoogleShoppingEnrollmentsCsv();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={onExport}
        className="rounded border border-zinc-600 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
      >
        {busy ? "Exporting…" : "Download CSV"}
      </button>
      {error ? <p className="text-xs text-red-300/90">{error}</p> : null}
    </div>
  );
}
