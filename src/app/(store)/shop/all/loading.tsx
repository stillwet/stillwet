export default function ShopAllLoading() {
  return (
    <div className="animate-pulse space-y-8" aria-busy="true" aria-label="Loading all items">
      <div className="h-9 w-56 max-w-full rounded bg-zinc-800" />
      <div className="space-y-3">
        <div className="mx-auto h-4 w-24 rounded bg-zinc-800" />
        <div className="mx-auto flex justify-center gap-3 py-2 md:gap-8">
          <div className="hidden h-36 w-36 shrink-0 rounded-lg bg-zinc-800/70 md:block" />
          <div className="h-44 w-44 shrink-0 rounded-xl bg-zinc-800 sm:h-52 sm:w-52" />
          <div className="hidden h-36 w-36 shrink-0 rounded-lg bg-zinc-800/70 md:block" />
        </div>
      </div>
      <div className="space-y-4 border-t border-zinc-800/60 pt-6">
        <div className="h-5 w-20 rounded bg-zinc-800" />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-16 rounded-full bg-zinc-800/90" />
          ))}
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 w-[175px] rounded-md bg-zinc-800/80" />
          ))}
        </div>
      </div>
    </div>
  );
}
