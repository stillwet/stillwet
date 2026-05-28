import Link from "next/link";
import { dashboardPromotionsUrl } from "@/lib/dashboard-promotions-path";

/** Server-only — link loads `?history=1` (no client JS). */
export function PromotionsHistoryCollapsed(props: {
  queryPreserve?: Record<string, string | undefined>;
}) {
  return (
    <details className="group mt-6 rounded-xl border border-zinc-800 bg-zinc-950/25">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-xs font-medium text-zinc-400 hover:text-zinc-200 [&::-webkit-details-marker]:hidden">
        Purchase history
        <span className="text-[10px] font-normal text-zinc-600 group-open:hidden">Expand</span>
      </summary>
      <p className="border-t border-zinc-800/80 px-4 pb-3 pt-2 text-[11px] text-zinc-600">
        <Link
          href={dashboardPromotionsUrl({ ...props.queryPreserve, history: "1" })}
          scroll={false}
          prefetch={false}
          className="text-violet-300/90 hover:text-violet-200"
        >
          Show purchase history
        </Link>
      </p>
    </details>
  );
}
