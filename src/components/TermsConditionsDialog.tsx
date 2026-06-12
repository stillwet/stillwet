"use client";

import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { TermsConditionsContent } from "@/components/TermsConditionsContent";

export function TermsConditionsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close terms and conditions"
        className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[5001] flex max-h-[min(85dvh,48rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-end border-b border-zinc-800 px-3 py-2 sm:px-4">
          <button
            type="button"
            aria-label="Close terms and conditions"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-zinc-700/80 bg-zinc-950/90 text-lg leading-none text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-100"
          >
            ×
          </button>
        </div>
        <div id={titleId} className="sr-only">
          Terms and conditions
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-8 pt-4 [scrollbar-gutter:stable] sm:px-8">
          <TermsConditionsContent />
        </div>
      </div>
    </div>,
    document.body,
  );
}
