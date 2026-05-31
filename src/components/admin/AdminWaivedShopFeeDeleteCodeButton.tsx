"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  adminDeleteWaivedShopFeeCode,
  type AdminDeleteWaivedShopFeeCodeResult,
} from "@/actions/admin-waived-shop-fees";

export function AdminWaivedShopFeeDeleteCodeButton(props: { codeId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    AdminDeleteWaivedShopFeeCodeResult | undefined,
    FormData
  >(async (_prev, formData) => {
    const result = await adminDeleteWaivedShopFeeCode(_prev, formData);
    if (result.ok) router.refresh();
    return result;
  }, undefined);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Delete this unused waived-fee code? It will no longer work for shop signup.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="codeId" value={props.codeId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-red-800/70 bg-red-950/40 px-2 py-0.5 text-[10px] font-medium text-red-200 hover:bg-red-900/50 disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {state?.ok === false ? (
        <p className="mt-1 max-w-[10rem] text-[10px] text-amber-300" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
