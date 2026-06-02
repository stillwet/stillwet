"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { adminUpdateCreatorGiftCodeNotes } from "@/actions/admin-creator-gift-code-notes";

const DEBOUNCE_MS = 750;
const MAX_LEN = 2000;

export function AdminCreatorGiftCodeNotesField(props: {
  codeId: string;
  initialNotes: string | null;
}) {
  const baseline = useRef((props.initialNotes ?? "").trim());
  const [value, setValue] = useState(props.initialNotes ?? "");
  const [status, setStatus] = useState<"idle" | "pending" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const gen = useRef(0);
  const [, startTransition] = useTransition();

  useEffect(() => {
    gen.current += 1;
    const next = props.initialNotes ?? "";
    setValue(next);
    baseline.current = next.trim();
    setStatus("idle");
    setError(null);
  }, [props.codeId, props.initialNotes]);

  const dirty = value.trim() !== baseline.current;

  useEffect(() => {
    if (!dirty) return;
    const g = gen.current;
    const t = window.setTimeout(() => {
      startTransition(async () => {
        setStatus("pending");
        const result = await adminUpdateCreatorGiftCodeNotes(props.codeId, value);
        if (g !== gen.current) return;
        if (result.ok) {
          baseline.current = value.trim();
          setStatus("saved");
          setError(null);
          window.setTimeout(() => {
            setStatus((current) => (current === "saved" ? "idle" : current));
          }, 2000);
        } else {
          setStatus("error");
          setError(result.error);
        }
      });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [dirty, value, props.codeId]);

  return (
    <div className="min-w-0">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, MAX_LEN))}
        rows={2}
        placeholder="Notes…"
        className="block w-full resize-y rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1.5 text-xs leading-snug text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
      />
      {status === "pending" ? (
        <p className="mt-1 text-[10px] text-zinc-500">Saving…</p>
      ) : status === "saved" ? (
        <p className="mt-1 text-[10px] text-emerald-400/80">Saved</p>
      ) : error ? (
        <p className="mt-1 text-[10px] text-red-300/90" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
