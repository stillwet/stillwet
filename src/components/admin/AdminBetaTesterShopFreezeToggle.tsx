"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  adminFreezeShop,
  adminUnfreezeShop,
  type AdminShopFreezeActionResult,
} from "@/actions/admin-shop-freeze";

function SegmentButton(props: {
  label: string;
  selected: boolean;
  selectedClassName: string;
  pending: boolean;
  disabled: boolean;
  onSubmit: (formData: FormData) => void;
  shopId: string;
}) {
  return (
    <form action={props.onSubmit}>
      <input type="hidden" name="shopId" value={props.shopId} />
      <button
        type="submit"
        disabled={props.disabled || props.selected || props.pending}
        className={`px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-default ${
          props.selected
            ? props.selectedClassName
            : "bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
        }`}
      >
        {props.pending ? "…" : props.label}
      </button>
    </form>
  );
}

export function AdminBetaTesterShopFreezeToggle(props: {
  shopId: string | null;
  adminFrozenAt: string | null;
}) {
  const router = useRouter();
  const isFrozen = props.adminFrozenAt != null;
  const hasShop = props.shopId != null;

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

  const pending = freezePending || unfreezePending;
  const error =
    freezeState?.ok === false
      ? freezeState.error
      : unfreezeState?.ok === false
        ? unfreezeState.error
        : null;

  const shopId = props.shopId ?? "";

  return (
    <div className="space-y-1">
      <div
        className={`inline-flex overflow-hidden rounded-md border border-zinc-700 ${hasShop ? "" : "opacity-50"}`}
      >
        <SegmentButton
          label="Active"
          selected={!isFrozen}
          selectedClassName="bg-emerald-950/60 text-emerald-200"
          pending={unfreezePending}
          disabled={!hasShop || pending}
          onSubmit={unfreezeAction}
          shopId={shopId}
        />
        <div className="border-l border-zinc-700">
          <SegmentButton
            label="Frozen"
            selected={isFrozen}
            selectedClassName="bg-red-950/60 text-red-200"
            pending={freezePending}
            disabled={!hasShop || pending}
            onSubmit={freezeAction}
            shopId={shopId}
          />
        </div>
      </div>
      {error ? (
        <p className="max-w-[8rem] text-[10px] text-amber-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
