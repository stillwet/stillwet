"use client";

import { useFormStatus } from "react-dom";

export function AdminFeaturedListSaveButton(props: { dirty: boolean; savedFlash: boolean }) {
  const { pending } = useFormStatus();
  const { dirty, savedFlash } = props;
  const label = pending ? "Saving…" : savedFlash && !dirty ? "Saved" : "Save";
  const disabled = !dirty || pending;

  return (
    <button
      type="submit"
      disabled={disabled}
      className={
        pending
          ? "rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 opacity-70"
          : dirty
            ? "rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
            : savedFlash
              ? "rounded-lg bg-emerald-950/40 px-4 py-2 text-sm font-medium text-emerald-200/90"
              : "rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-500"
      }
    >
      {label}
    </button>
  );
}
