"use client";

import { useEffect } from "react";
import { ItemGuidelinesArticle } from "@/components/ItemGuidelinesArticle";

export function ItemGuidelinesPopup(props: {
  open: boolean;
  onClose: () => void;
  /** Listing attestation dialog: compact chrome without footer note or dismiss hints. */
  variant?: "default" | "compact";
}) {
  const { open, onClose, variant = "default" } = props;
  const compact = variant === "compact";

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Shop regulations"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[min(85dvh,48rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-zinc-100">Shop regulations</h3>
            {!compact ? (
              <p className="mt-1 text-xs text-zinc-500">Press Escape or click outside to close.</p>
            ) : null}
          </div>
          {compact ? (
            <button
              type="button"
              aria-label="Close shop regulations"
              onClick={onClose}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-zinc-700/80 bg-zinc-950/90 text-lg leading-none text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-100"
            >
              ×
            </button>
          ) : (
            <button
              type="button"
              className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ItemGuidelinesArticle className="space-y-4 text-sm leading-relaxed text-zinc-300" />

          {!compact ? (
            <p className="mt-4 text-xs text-zinc-600">
              This page is a practical summary, not legal advice. For storefront policies that fans see, see also{" "}
              <a
                href="/shop-regulations"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400/90 underline underline-offset-2 hover:text-blue-300"
                onClick={(e) => e.stopPropagation()}
              >
                shop regulations
              </a>
              .
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
