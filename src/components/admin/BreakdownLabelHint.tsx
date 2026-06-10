"use client";

import { useEffect, useRef, useState } from "react";

export function BreakdownLabelHint({
  label,
  hint,
  hintPosition = "below",
  elevated = false,
}: {
  label: string;
  hint: string;
  hintPosition?: "above" | "below";
  /** Higher stacking when nested inside fixed popups. */
  elevated?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const hintZ = elevated ? "z-[110]" : "z-20";
  const hintClass =
    hintPosition === "above"
      ? `absolute bottom-full left-0 ${hintZ} mb-1 w-max max-w-[14rem] rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[10px] normal-case tracking-normal text-zinc-300 shadow-lg`
      : `absolute left-0 top-full ${hintZ} mt-1 w-max max-w-[14rem] rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[10px] normal-case tracking-normal text-zinc-300 shadow-lg`;

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
    <span ref={rootRef} className="inline-flex items-center gap-1">
      {label}
      <span className="relative inline-block">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label={`About ${label}`}
          className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-zinc-600 text-[9px] font-semibold leading-none text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
        >
          ?
        </button>
        {open ? <p className={hintClass}>{hint}</p> : null}
      </span>
    </span>
  );
}
