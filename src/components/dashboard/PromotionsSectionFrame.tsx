import type { ReactNode } from "react";

/** Static chrome for paid placement checkout on the shop upgrades page (server-rendered). */
export function PromotionsSectionFrame({ children }: { children: ReactNode }) {
  return (
    <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/25">
      <div className="px-4 pt-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-violet-400/95">
          Paid placements
        </h2>
      </div>
      <div className="border-b border-zinc-800/80 px-4 pb-3 pt-1">
        <p className="text-[11px] leading-snug text-zinc-600">
          Paying for a placement bumps you toward the front of discovery surfaces (on stillwet.com).
        </p>
      </div>
      <div className="px-4 pb-4 pt-3">{children}</div>
    </section>
  );
}
