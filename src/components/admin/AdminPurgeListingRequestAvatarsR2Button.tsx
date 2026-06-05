"use client";

import { useActionState } from "react";
import {
  adminPurgeR2ExceptSiteLogoAction,
  type AdminPurgeR2ExceptSiteLogoResult,
} from "@/actions/admin";
import { SITE_EMAIL_LOGO_R2_OBJECT_KEY } from "@/lib/site-email-logo-constants";

export function AdminPurgeListingRequestAvatarsR2Button() {
  const [state, formAction, pending] = useActionState<
    AdminPurgeR2ExceptSiteLogoResult | null,
    FormData
  >(adminPurgeR2ExceptSiteLogoAction, null);

  const btnClass =
    "rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:border-zinc-600 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <details className="relative">
      <summary className="cursor-pointer list-none text-xs font-medium text-zinc-500 hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
        R2 purge (keep logo)
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-80 rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-xl">
        <p className="text-[11px] leading-relaxed text-zinc-500">
          Deletes every object in the R2 bucket except the site email logo (
          <span className="font-mono text-zinc-400">{SITE_EMAIL_LOGO_R2_OBJECT_KEY}</span>
          ). Includes test uploads, listing images, shop artwork, and avatars. Does not change database
          URLs.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <form action={formAction}>
            <input type="hidden" name="intent" value="preview" />
            <button type="submit" disabled={pending} className={btnClass}>
              {pending ? "Scanning…" : "Preview count"}
            </button>
          </form>
          <form action={formAction} className="flex flex-col gap-2">
            <input type="hidden" name="intent" value="delete" />
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-500">
              <input type="checkbox" name="confirm" value="on" className="border-zinc-600 bg-zinc-900" />
              Confirm delete
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded border border-red-900/50 bg-red-950/40 px-2 py-1 text-[11px] font-medium text-red-200/90 hover:bg-red-950/70 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Deleting…" : "Delete all except logo"}
            </button>
          </form>
        </div>
        {state?.ok ? (
          <p className="mt-2 text-[11px] text-emerald-300/90" role="status">
            {state.variant === "preview"
              ? `${state.targetKeyCount} of ${state.totalObjectCount} object(s) would be deleted (${state.keptKeys.length} kept).`
              : `Deleted ${state.deletedCount} of ${state.targetKeyCount} object(s). Kept: ${state.keptKeys.join(", ") || "none"}.`}
          </p>
        ) : null}
        {state && !state.ok ? (
          <p className="mt-2 text-[11px] text-red-300/90" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>
    </details>
  );
}
