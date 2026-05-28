"use client";

import { useEffect, useMemo, useState } from "react";

type TodoItem = {
  id: string;
  text: string;
  done: boolean;
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalize(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

export function AdminLocalTodoList(props: {
  storageKey: string;
  initialItems: string[];
}) {
  const { storageKey, initialItems } = props;
  const fallback = useMemo<TodoItem[]>(
    () => initialItems.map((text) => ({ id: uid(), text, done: false })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [items, setItems] = useState<TodoItem[]>(fallback);
  const [draft, setDraft] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          const next = parsed
            .filter((x): x is { id: unknown; text: unknown; done: unknown } => Boolean(x && typeof x === "object"))
            .map((x) => ({
              id: typeof x.id === "string" && x.id.trim() ? x.id : uid(),
              text: typeof x.text === "string" ? normalize(x.text) : "",
              done: x.done === true,
            }))
            .filter((x) => x.text.length > 0);
          if (next.length > 0) setItems(next);
        }
      }
    } catch {
      // ignore corrupt localStorage
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // ignore quota / privacy mode failures
    }
  }, [hydrated, items, storageKey]);

  function remove(id: string) {
    setItems((cur) => cur.filter((t) => t.id !== id));
  }

  function add() {
    const text = normalize(draft);
    if (!text) return;
    setItems((cur) => [{ id: uid(), text, done: false }, ...cur]);
    setDraft("");
  }

  function resetToDefaults() {
    setItems(fallback);
    setDraft("");
  }

  return (
    <div className="mt-3 rounded-lg border border-zinc-800/70 bg-zinc-950/30 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          To do{" "}
          <span className="font-mono text-[10px] text-zinc-600" aria-label={`${items.length} remaining`}>
            ({items.length})
          </span>
        </p>
        <button
          type="button"
          onClick={resetToDefaults}
          className="text-[11px] text-zinc-600 underline-offset-2 hover:text-zinc-400 hover:underline"
        >
          Reset
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="Add a to do…"
          className="w-full rounded-md border border-zinc-800 bg-zinc-950/50 px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-700 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
        />
        <button
          type="button"
          onClick={add}
          className="shrink-0 rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900/40"
        >
          Add
        </button>
      </div>

      <ul className="mt-2 space-y-1.5">
        {items.map((t) => (
          <li key={t.id} className="flex items-start justify-between gap-2">
            <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={false}
                onChange={() => remove(t.id)}
                className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-violet-500"
                aria-label={`Mark done and remove: ${t.text}`}
              />
              <span className="min-w-0 break-words text-zinc-300">{t.text}</span>
            </label>
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="shrink-0 text-[11px] text-zinc-700 hover:text-zinc-400"
              aria-label={`Remove todo: ${t.text}`}
              title="Remove"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

