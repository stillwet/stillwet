"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  adminFreezeShop,
  adminUnfreezeShop,
  type AdminShopFreezeActionResult,
} from "@/actions/admin-shop-freeze";

export function AdminShopFreezeControls(props: {
  shopId: string;
  adminFrozenAt: string | null;
}) {
  const router = useRouter();
  const [freezeState, freezeAction, freezePending] = useActionState<
    AdminShopFreezeActionResult | undefined,
    FormData
  >(async (prev, formData) => {
    const result = await adminFreezeShop(prev, formData);
    if (result.ok) router.refresh();
    return result;
  }, undefined);

  const [unfreezeState, unfreezeAction, unfreezePending] = useActionState<
    AdminShopFreezeActionResult | undefined,
    FormData
  >(async (prev, formData) => {
    const result = await adminUnfreezeShop(prev, formData);
    if (result.ok) router.refresh();
    return result;
  }, undefined);

  const isFrozen = props.adminFrozenAt != null;
  const pending = freezePending || unfreezePending;
  const error = freezeState?.ok === false ? freezeState.error : unfreezeState?.ok === false ? unfreezeState.error : null;

  return (
    <div className="mt-2 space-y-1">
      {isFrozen ? (
        <span className="inline-flex rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-200">
          Shop frozen
        </span>
      ) : null}
      <form action={isFrozen ? unfreezeAction : freezeAction}>
        <input type="hidden" name="shopId" value={props.shopId} />
        <button
          type="submit"
          disabled={pending}
          className={
            isFrozen
              ? "rounded border border-emerald-700/70 bg-emerald-950/40 px-2 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-900/50 disabled:opacity-50"
              : "rounded border border-red-800/70 bg-red-950/40 px-2 py-1 text-xs font-medium text-red-200 hover:bg-red-900/50 disabled:opacity-50"
          }
        >
          {pending ? "Saving…" : isFrozen ? "Unfreeze shop" : "Freeze shop"}
        </button>
      </form>
      {error ? (
        <p className="text-xs text-amber-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
