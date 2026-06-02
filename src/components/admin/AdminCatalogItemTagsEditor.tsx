"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  adminLinkCatalogItemTag,
  adminUnlinkCatalogItemTag,
} from "@/actions/admin-catalog-items";

export type AdminListItemTag = {
  id: string;
  name: string;
  slug: string;
};

export type AdminListTagOption = {
  id: string;
  name: string;
  slug: string;
};

export function AdminCatalogItemTagsEditor({
  itemId,
  linkedTags,
  allTags,
}: {
  itemId: string;
  linkedTags: AdminListItemTag[];
  allTags: AdminListTagOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pick, setPick] = useState("");

  const linkedIds = new Set(linkedTags.map((t) => t.id));
  const available = allTags.filter((t) => !linkedIds.has(t.id));

  function addTag() {
    if (!pick) return;
    const fd = new FormData();
    fd.set("itemId", itemId);
    fd.set("tagId", pick);
    startTransition(async () => {
      await adminLinkCatalogItemTag(fd);
      setPick("");
      router.refresh();
    });
  }

  function removeTag(tagId: string) {
    const fd = new FormData();
    fd.set("itemId", itemId);
    fd.set("tagId", tagId);
    startTransition(async () => {
      await adminUnlinkCatalogItemTag(fd);
      router.refresh();
    });
  }

  return (
    <div className="mt-2 border-t border-zinc-800 pt-4">
      <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Tags</h4>
      <p className="mt-1 text-[11px] text-zinc-600">
        Tags control storefront browse for baseline-linked listings. Changes save immediately.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {linkedTags.map((t) => (
          <span
            key={t.id}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-zinc-600 bg-zinc-900/80 px-2 py-0.5 text-[11px] text-zinc-200"
          >
            <span className="min-w-0 truncate" title={t.name}>
              {t.name}
            </span>
            <button
              type="button"
              disabled={pending}
              title={`Remove “${t.name}” from this item`}
              className="shrink-0 text-zinc-500 hover:text-rose-300 disabled:opacity-50"
              onClick={() => removeTag(t.id)}
            >
              ×
            </button>
          </span>
        ))}
        {linkedTags.length === 0 ? <span className="text-[11px] text-zinc-600">No tags linked.</span> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          disabled={pending || available.length === 0}
          aria-label="Add tag to this catalog item"
          className="min-w-0 max-w-xs flex-1 rounded border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100"
        >
          <option value="">Add tag…</option>
          {available.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addTag}
          disabled={pending || !pick}
          className="shrink-0 rounded border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          Add tag
        </button>
      </div>
      {allTags.length === 0 ? (
        <p className="mt-3 text-[11px] text-amber-200/80">
          No tags exist yet — add some on the{" "}
          <Link href="/admin/backend?tab=tags" className="text-amber-100/90 underline-offset-2 hover:underline">
            Tags
          </Link>{" "}
          tab first.
        </p>
      ) : (
        <p className="mt-3 text-[11px] leading-snug text-zinc-600">
          <Link href="/admin/backend?tab=tags" className="text-blue-400/80 hover:underline">
            Create or rename tags
          </Link>{" "}
          on the Tags tab.
        </p>
      )}
    </div>
  );
}
