/** Placeholder while the picker segment loads — Popular first, then the other kinds. */
export function PromotionsPickerSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading promotion options">
      <div className="h-3 w-24 rounded bg-zinc-800/80 animate-pulse" />
      <ul className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="w-full">
            <div
              className={`h-[52px] w-full rounded-md border border-zinc-800 bg-zinc-950/50 ${i === 0 ? "animate-pulse" : ""}`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
