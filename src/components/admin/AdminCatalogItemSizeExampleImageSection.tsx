"use client";

import { useActionState, useEffect } from "react";
import {
  adminClearCatalogItemSizeExampleImage,
  adminUpsertCatalogItemSizeExampleImageForm,
  type AdminCatalogSizeExampleImageFormState,
} from "@/actions/admin-catalog-item-reference-image";

const initialUploadState: AdminCatalogSizeExampleImageFormState = {
  ok: false,
  error: null,
};

export function AdminCatalogItemSizeExampleImageSection({
  catalogItemId,
  sizeExampleImageUrl,
  onUploadedUrl,
  r2Configured,
}: {
  catalogItemId: string;
  sizeExampleImageUrl: string;
  onUploadedUrl: (url: string) => void;
  r2Configured: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    adminUpsertCatalogItemSizeExampleImageForm,
    initialUploadState,
  );

  useEffect(() => {
    if (state.ok && state.url?.trim()) {
      onUploadedUrl(state.url.trim());
    }
  }, [state.ok, state.url, onUploadedUrl]);

  if (!r2Configured) {
    return (
      <p className="text-[11px] text-amber-200/85">
        R2 is not configured — file upload unavailable. Paste an HTTPS URL above or set R2 env vars.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <form action={formAction} className="flex flex-col gap-2 sm:max-w-lg">
        <input type="hidden" name="catalogItemId" value={catalogItemId} />
        <label className="block text-[11px] text-zinc-500">
          Upload file (JPEG / PNG / WebP / GIF, max 20 MB before compression)
          <input
            type="file"
            name="catalogItemSizeExampleImageFile"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="mt-1 block w-full max-w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-zinc-800 file:px-2 file:py-1 file:text-zinc-200"
          />
        </label>
        <label className="block text-[11px] text-zinc-500">
          Or import from HTTPS URL
          <input
            type="url"
            name="catalogItemSizeExampleImageUrl"
            placeholder="https://…"
            className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-200"
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Uploading…" : "Upload Size Ex Pic to R2"}
        </button>
        {state.ok ? <p className="text-xs text-emerald-400/95">Size Ex Pic saved.</p> : null}
        {state.error ? (
          <p className="text-xs text-red-400/95" role="alert">
            {state.error}
          </p>
        ) : null}
      </form>
      {sizeExampleImageUrl.trim() ? (
        <form action={adminClearCatalogItemSizeExampleImage}>
          <input type="hidden" name="catalogItemId" value={catalogItemId} />
          <button
            type="submit"
            className="rounded border border-zinc-600 px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          >
            Remove saved Size Ex Pic
          </button>
        </form>
      ) : null}
    </div>
  );
}

/** @deprecated Use {@link AdminCatalogItemSizeExampleImageSection} */
export const AdminCatalogItemReferenceImageSection = AdminCatalogItemSizeExampleImageSection;
