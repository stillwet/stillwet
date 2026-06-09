"use client";

import { useMemo, useState } from "react";
import { AdminListAddItemForm } from "@/components/admin/AdminListAddItemForm";
import { AdminSecretMenuImportFromListPanel } from "@/components/admin/AdminSecretMenuImportFromListPanel";
import type { AdminCatalogSecretMenuImportOption } from "@/lib/admin-secret-menu-catalog-copy";

export function AdminSecretMenuCatalogActionsPanel(props: {
  importOptions: AdminCatalogSecretMenuImportOption[];
  smImported?: string;
  smImportSkipped?: string;
}) {
  const { importOptions, smImported, smImportSkipped } = props;
  const [addFormOpen, setAddFormOpen] = useState(false);

  const importableCount = useMemo(
    () => importOptions.filter((o) => !o.alreadyImported).length,
    [importOptions],
  );

  const hasImportContent =
    Boolean(smImported?.trim()) ||
    (importOptions.length > 0 && importableCount > 0) ||
    addFormOpen;

  return (
    <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/40">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 px-3 py-2 ${
          hasImportContent ? "border-b border-zinc-800/80" : ""
        }`}
      >
        <AdminSecretMenuImportFromListPanel
          importOptions={importOptions}
          smImported={smImported}
          smImportSkipped={smImportSkipped}
          part="toolbar"
        />
        {!addFormOpen ? (
          <button
            type="button"
            onClick={() => setAddFormOpen(true)}
            className="shrink-0 rounded-md border border-blue-900/50 bg-blue-950/30 px-3 py-1 text-xs font-medium text-blue-200/95 hover:bg-blue-950/45"
          >
            Add new catalogue item
          </button>
        ) : null}
      </div>

      {hasImportContent ? (
        <div className="space-y-0 px-3 pb-3 pt-3">
          <AdminSecretMenuImportFromListPanel
            importOptions={importOptions}
            smImported={smImported}
            smImportSkipped={smImportSkipped}
            part="content"
          />
          {addFormOpen ? (
            <AdminListAddItemForm
              secretMenuCatalog
              embedded
              open={addFormOpen}
              onOpenChange={setAddFormOpen}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
