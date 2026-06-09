"use client";

import { adminUnpublishPrintifyAuxProduct } from "@/actions/admin";

export function PrintifyAuxUnpublishForm({ printifyProductId }: { printifyProductId: string }) {
  return (
    <form className="inline-block" action={adminUnpublishPrintifyAuxProduct}>
      <input type="hidden" name="printifyProductId" value={printifyProductId} />
      <button
        type="submit"
        className="rounded border border-amber-900/60 bg-amber-950/35 px-2.5 py-1 text-xs text-amber-200/90 hover:bg-amber-950/55"
      >
        Unpublish
      </button>
    </form>
  );
}
