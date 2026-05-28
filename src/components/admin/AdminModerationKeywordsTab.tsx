import Link from "next/link";
import {
  adminAddModerationKeywordForm,
  adminDeleteModerationKeywordForm,
} from "@/actions/admin-moderation-keywords";
import { ADMIN_MAIN_BASE_PATH } from "@/lib/admin-dashboard-urls";

export type AdminModerationKeywordRow = {
  id: string;
  phrase: string;
  createdAtIso: string;
};

export type AdminModerationKeywordSpotlightRow = {
  listingId: string;
  shopSlug: string;
  shopDisplayName: string;
  matches: string[];
};

export function AdminModerationKeywordsTab(props: {
  rows: AdminModerationKeywordRow[];
  spotlightRows: AdminModerationKeywordSpotlightRow[];
  migrationRequired?: boolean;
  kwErr?: string;
  kwSaved?: string;
}) {
  const { rows, spotlightRows, migrationRequired, kwErr, kwSaved } = props;

  return (
    <section id="keyword-triggers" aria-label="Moderation keyword triggers">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Keyword triggers</h2>
      <p className="mt-1 text-xs leading-relaxed text-zinc-600">
        Creator saves are blocked when shop profile or listing text (name, one-liner, keywords) contains any of
        these phrases. Matching is case-insensitive; spaces inside a phrase matter.
      </p>

      {migrationRequired ? (
        <p className="mt-3 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-2 text-xs leading-relaxed text-amber-200/90">
          The keyword bank table is not available on this database yet. Run{" "}
          <code className="rounded bg-zinc-950/60 px-1 py-0.5 font-mono text-amber-100/90">
            npx prisma migrate deploy
          </code>{" "}
          (migration <code className="font-mono text-amber-100/90">20260516120000_moderation_keyword</code>
          ), then reload. Other backend admin tabs still work.
        </p>
      ) : null}

      {kwSaved === "added" ? (
        <p
          role="status"
          className="mt-3 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90"
        >
          Phrase added.
        </p>
      ) : null}
      {kwSaved === "deleted" ? (
        <p
          role="status"
          className="mt-3 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90"
        >
          Phrase removed.
        </p>
      ) : null}
      {kwErr ? (
        <p className="mt-3 rounded border border-blue-900/50 bg-blue-950/30 px-3 py-2 text-xs text-blue-200/90">
          {kwErr}
        </p>
      ) : null}

      <form action={adminAddModerationKeywordForm} className="mt-4 flex flex-wrap items-end gap-2">
        <label className="block min-w-[12rem] flex-1 text-[11px] text-zinc-500">
          Add phrase
          <input
            type="text"
            name="phrase"
            required
            maxLength={200}
            disabled={migrationRequired}
            placeholder="e.g. Pay me"
            className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 disabled:opacity-50"
          />
        </label>
        <button
          type="submit"
          disabled={migrationRequired}
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <ul className="mt-6 divide-y divide-zinc-800 border-y border-zinc-800 text-sm">
        {rows.length === 0 ? (
          <li className="py-4 text-zinc-500">No phrases yet. Run the database migration to seed defaults.</li>
        ) : (
          rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 text-zinc-300"
            >
              <div className="min-w-0">
                <p className="font-medium text-zinc-100">&ldquo;{r.phrase}&rdquo;</p>
                <p className="mt-0.5 text-[11px] text-zinc-600">Added {r.createdAtIso}</p>
              </div>
              <form action={adminDeleteModerationKeywordForm}>
                <input type="hidden" name="keywordId" value={r.id} />
                <button
                  type="submit"
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-400 hover:border-red-900/50 hover:bg-red-950/30 hover:text-red-200/90"
                >
                  Remove
                </button>
              </form>
            </li>
          ))
        )}
      </ul>

      <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Recent listings matching bank</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
          Sample of up to 30 non-platform listings (by last update) whose saved listing text or shop profile text
          matches the current list. Open{" "}
          <Link href={`${ADMIN_MAIN_BASE_PATH}?tab=requests`} className="text-blue-400/90 underline">
            Listing requests
          </Link>{" "}
          for full workflow tools.
        </p>
        {spotlightRows.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">No matches in the sampled rows.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-xs text-zinc-400">
            {spotlightRows.map((s) => (
              <li key={s.listingId} className="rounded border border-zinc-800/80 bg-zinc-900/30 px-3 py-2">
                <span className="font-medium text-zinc-200">{s.shopDisplayName}</span>
                <span className="text-zinc-600"> · </span>
                <Link
                  href={`${ADMIN_MAIN_BASE_PATH}?tab=requests&listing=${encodeURIComponent(s.listingId)}`}
                  className="text-blue-400/90 underline"
                >
                  Listing
                </Link>
                <span className="text-zinc-600"> — matches: </span>
                <span className="text-amber-200/85">{s.matches.map((m) => `"${m}"`).join(", ")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
