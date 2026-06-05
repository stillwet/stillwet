"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acknowledgeShopItemGuidelines } from "@/actions/dashboard-shop-setup";
import { ItemGuidelinesArticle } from "@/components/ItemGuidelinesArticle";

const btnAcknowledge =
  "rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed";
const btnAcknowledgePending =
  "cursor-wait rounded-lg bg-zinc-100/70 px-4 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-300/60";
const btnAcknowledged =
  "cursor-default rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-2 text-sm font-medium text-emerald-300 ring-1 ring-emerald-800/40";

export function ShopItemGuidelinesPanel(props: {
  acknowledged: boolean;
  /** When true, used inside dashboard tab panel (no top margin). */
  embedded?: boolean;
}) {
  const { acknowledged: acknowledgedProp, embedded = false } = props;
  const router = useRouter();
  const [acknowledged, setAcknowledged] = useState(acknowledgedProp);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setAcknowledged(acknowledgedProp);
  }, [acknowledgedProp]);

  function handleAcknowledge() {
    startTransition(async () => {
      await acknowledgeShopItemGuidelines();
      setAcknowledged(true);
      router.refresh();
    });
  }

  return (
    <section
      className={`rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:p-6 ${embedded ? "mt-0" : "mt-8"}`}
    >
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Shop regulations</h2>

      <div className="mt-4">
        <ItemGuidelinesArticle className="space-y-4 text-sm leading-relaxed text-zinc-300" />

        <div className="pt-4">
          <button
            type="button"
            disabled={acknowledged || pending}
            onClick={handleAcknowledge}
            className={
              acknowledged ? btnAcknowledged : pending ? btnAcknowledgePending : btnAcknowledge
            }
          >
            {acknowledged
              ? "Acknowledged"
              : pending
                ? "Acknowledging…"
                : "I have read and acknowledge the shop regulations"}
          </button>
        </div>
      </div>
    </section>
  );
}
