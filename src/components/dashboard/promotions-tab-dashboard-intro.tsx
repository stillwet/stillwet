import type { ReactNode } from "react";
/** Shared copy for Promotions tab — no hooks; safe from server or client importers. */
export function PromotionsTabIntroParagraph(): ReactNode {
  return (
    <p className="mt-2 text-[11px] leading-snug text-zinc-500">
      Promotions are active for two week periods. Mid-cycle puchases are prorated. If the upcoming promotion cycle slots
      are already filled, you may buy a promotion for the following cycle at twice the promotion cost.
    </p>
  );
}

export function PromotionsTabFooterParagraph(): ReactNode {
  return (
    <p className="mt-4 text-[11px] leading-snug text-zinc-600">
      Paying for promotion bumps you toward the front of discovery surfaces.
    </p>
  );
}
