import { LARGE_LISTING_ARTWORK_MIGRATION } from "@/lib/admin-baseline-catalog-rows";

export function AdminListTabLoadError({ message }: { message: string }) {
  const looksLikeMissingColumn =
    /itemLargeListingArtwork/i.test(message) &&
    /does not exist|Unknown column|P2022|42703|column/i.test(message);

  return (
    <div className="rounded-xl border border-amber-900/50 bg-amber-950/25 px-4 py-4 text-sm text-amber-100/90">
      <p className="font-medium text-amber-50">Admin list could not load</p>
      <p className="mt-2 text-amber-200/80">
        {looksLikeMissingColumn ? (
          <>
            Production Postgres is missing migration{" "}
            <code className="rounded bg-zinc-950/80 px-1 py-0.5 font-mono text-[11px] text-amber-100/90">
              {LARGE_LISTING_ARTWORK_MIGRATION}
            </code>
            . Run{" "}
            <code className="rounded bg-zinc-950/80 px-1 py-0.5 font-mono text-[11px] text-amber-100/90">
              npm run db:migrate:prod
            </code>{" "}
            (after <code className="font-mono text-[11px]">vercel env pull</code>), then reload.
          </>
        ) : (
          "Something went wrong loading catalog items. Check Vercel logs for this page load."
        )}
      </p>
      <pre className="mt-3 max-h-32 overflow-auto rounded border border-amber-900/40 bg-zinc-950/80 p-2 font-mono text-[11px] text-zinc-300">
        {message}
      </pre>
    </div>
  );
}
