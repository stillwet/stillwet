/** Read-only list of active promotion placement rows for admin Promotion lists tab. */
export function AdminActivePromotionsReadOnlyList(props: {
  title: string;
  ids: string[];
  labelsById: Record<string, string>;
  emptyMessage: string;
}) {
  const { title, ids, labelsById, emptyMessage } = props;

  return (
    <div className="border-t border-zinc-800/80 pt-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{title}</p>
      {ids.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-600">{emptyMessage}</p>
      ) : (
        <ol className="mt-2 space-y-2">
          {ids.map((id, idx) => (
            <li
              key={id}
              className="rounded-lg border border-zinc-800/90 bg-zinc-900/25 px-3 py-2 text-xs text-zinc-300"
            >
              <span className="tabular-nums text-zinc-500">{idx + 1}. </span>
              {labelsById[id] ?? id}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
