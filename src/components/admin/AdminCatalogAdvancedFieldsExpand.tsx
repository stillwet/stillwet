"use client";

import { useState } from "react";

export function AdminCatalogFieldsExpand({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className="rounded-lg border border-zinc-800/80 bg-zinc-950/30"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer select-none list-none px-3 py-2.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 [&::-webkit-details-marker]:hidden">
        {label}
      </summary>
      <div className="space-y-4 border-t border-zinc-800/80 px-3 pb-3 pt-3">{children}</div>
    </details>
  );
}

/** @deprecated Use {@link AdminCatalogFieldsExpand} with a custom label. */
export function AdminCatalogAdvancedFieldsExpand({
  defaultOpen = false,
  children,
}: {
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <AdminCatalogFieldsExpand
      label="Expand for more — artwork rules &amp; crop preview"
      defaultOpen={defaultOpen}
    >
      {children}
    </AdminCatalogFieldsExpand>
  );
}

export function AdminCatalogPicturesExpand({
  defaultOpen = false,
  children,
}: {
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <AdminCatalogFieldsExpand label="Pictures" defaultOpen={defaultOpen}>
      {children}
    </AdminCatalogFieldsExpand>
  );
}
