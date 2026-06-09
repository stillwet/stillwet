"use client";

import { useMemo, useState } from "react";
import { adminImportStandardCatalogItemsToSecretMenu } from "@/actions/admin-secret-menu";
import type { AdminCatalogSecretMenuImportOption } from "@/lib/admin-secret-menu-catalog-copy";

export function AdminSecretMenuImportFromListPanel(props: {
  importOptions: AdminCatalogSecretMenuImportOption[];
  smImported?: string;
  smImportSkipped?: string;
  part?: "full" | "toolbar" | "content";
}) {
  const { importOptions, smImported, smImportSkipped, part = "full" } = props;
  const importable = useMemo(
    () => importOptions.filter((o) => !o.alreadyImported),
    [importOptions],
  );
  const alreadyImported = useMemo(
    () => importOptions.filter((o) => o.alreadyImported),
    [importOptions],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const allImportableSelected =
    importable.length > 0 && importable.every((o) => selectedIds.has(o.id));
  const someSelected = importable.some((o) => selectedIds.has(o.id));

  function toggleItem(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllImportable(checked: boolean) {
    setSelectedIds(checked ? new Set(importable.map((o) => o.id)) : new Set());
  }

  const title = (
    <h3 className="shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-500">
      Import from Admin list
    </h3>
  );

  const toolbarStatus =
    importOptions.length === 0 ? (
      <p className="text-xs text-amber-200/90" role="status">
        Add items on the Admin list tab first.
      </p>
    ) : importable.length === 0 ? (
      <p className="text-xs text-zinc-500" role="status">
        Every Admin list item is already in the secret menu catalog.
      </p>
    ) : null;

  if (part === "toolbar") {
    const toolbarHint =
      importable.length > 0 ? (
        <p className="text-xs text-zinc-500" role="status">
          {importable.length} available to import
        </p>
      ) : (
        toolbarStatus
      );

    return (
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        {title}
        {toolbarHint}
      </div>
    );
  }

  const importedBanner =
    smImported && smImported.trim() ? (
      <p
        role="status"
        className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90"
      >
        Imported {smImported} item{smImported === "1" ? "" : "s"} from the Admin list.
        {smImportSkipped && smImportSkipped !== "0" ? (
          <>
            {" "}
            Skipped {smImportSkipped} already in secret menu.
          </>
        ) : null}
      </p>
    ) : null;

  const importForm =
    importable.length > 0 ? (
      <details className="rounded-lg border border-zinc-800/80 bg-zinc-950/30">
        <summary className="cursor-pointer select-none list-none px-3 py-2.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 [&::-webkit-details-marker]:hidden">
          Select items to import ({importable.length})
        </summary>
        <div className="space-y-3 border-t border-zinc-800/80 px-3 pb-3 pt-3">
          <form action={adminImportStandardCatalogItemsToSecretMenu} className="space-y-3">
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={allImportableSelected}
                onChange={(e) => toggleAllImportable(e.target.checked)}
                className="rounded border-zinc-600 bg-zinc-900"
              />
              Select all available ({importable.length})
            </label>

            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
              {importable.map((option) => (
                <li key={option.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900/80">
                    <input
                      type="checkbox"
                      name="sourceItemId"
                      value={option.id}
                      checked={selectedIds.has(option.id)}
                      onChange={(e) => toggleItem(option.id, e.target.checked)}
                      className="mt-0.5 rounded border-zinc-600 bg-zinc-900"
                    />
                    <span className="min-w-0 flex-1">{option.name}</span>
                  </label>
                </li>
              ))}
            </ul>

            {alreadyImported.length > 0 ? (
              <details className="text-[11px] text-zinc-600">
                <summary className="cursor-pointer select-none text-zinc-500 hover:text-zinc-400">
                  {alreadyImported.length} already in secret menu
                </summary>
                <ul className="mt-2 space-y-0.5 pl-3">
                  {alreadyImported.map((option) => (
                    <li key={option.id} className="text-zinc-600">
                      {option.name}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            <button
              type="submit"
              disabled={!someSelected}
              className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Import selected
            </button>
          </form>
        </div>
      </details>
    ) : null;

  if (part === "content") {
    if (!importedBanner && !importForm) return null;
    return (
      <div className="space-y-3">
        {importedBanner}
        {importForm}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
      {title}
      {importedBanner ? <div className="mt-3">{importedBanner}</div> : null}
      {importOptions.length === 0 ? (
        <p className="mt-3 text-xs text-amber-200/90" role="status">
          Add items on the Admin list tab first.
        </p>
      ) : importable.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500" role="status">
          Every Admin list item is already in the secret menu catalog.
        </p>
      ) : (
        <div className="mt-4">{importForm}</div>
      )}
    </div>
  );
}
