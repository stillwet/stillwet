"use client";

import { adminUnpublishAllPrintifyAuxProducts } from "@/actions/admin";

export function PrintifyAuxUnpublishAllForm({ productCount }: { productCount: number }) {
  return (
    <form
      className="inline-block"
      action={adminUnpublishAllPrintifyAuxProducts}
      onSubmit={(e) => {
        const msg =
          productCount === 1
            ? "Unpublish the 1 product in this catalogue shop?"
            : `Unpublish all ${productCount} products in this catalogue shop?`;
        if (!window.confirm(msg)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="confirm" value="unpublish_all" />
      <button
        type="submit"
        className="rounded border border-amber-800/70 bg-amber-950/50 px-3 py-1.5 text-xs font-medium text-amber-100/95 hover:bg-amber-950/70"
      >
        Unpublish all ({productCount})
      </button>
    </form>
  );
}
