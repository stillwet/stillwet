"use client";

import { useEffect, useRef, useState } from "react";

export function BreakdownLabelHint({
  label,
  hint,
  hintPosition = "below",
}: {
  label: string;
  hint: string;
  hintPosition?: "above" | "below";
  /** @deprecated In-flow hints no longer need elevated stacking. */
  elevated?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const hintPanelClass =
    "w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-left text-[10px] normal-case tracking-normal text-zinc-300 shadow-lg break-words whitespace-normal";

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  return (
    <span ref={rootRef} className="block w-full min-w-0 max-w-full">
      {hintPosition === "above" && open ? <p className={`mb-1 ${hintPanelClass}`}>{hint}</p> : null}
      <span className="inline-flex items-center gap-1">
        {label}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label={`About ${label}`}
          className="inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full border border-zinc-600 text-[9px] font-semibold leading-none text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
        >
          ?
        </button>
      </span>
      {hintPosition === "below" && open ? <p className={`mt-1 ${hintPanelClass}`}>{hint}</p> : null}
    </span>
  );
}
