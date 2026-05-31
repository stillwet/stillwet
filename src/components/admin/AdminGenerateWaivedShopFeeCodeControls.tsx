"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  adminGenerateWaivedShopFeeCode,
  type AdminGenerateWaivedShopFeeCodeResult,
} from "@/actions/admin-waived-shop-fees";

export function AdminGenerateWaivedShopFeeCodeControls() {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    AdminGenerateWaivedShopFeeCodeResult | undefined,
    FormData
  >(async (_prev, formData) => {
    const result = await adminGenerateWaivedShopFeeCode(_prev, formData);
    if (result.ok) router.refresh();
    return result;
  }, undefined);

  return (
    <div className="mt-4 space-y-2">
      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Generating…" : "Generate 1 code"}
        </button>
      </form>
      {state?.ok === true ? (
        <p className="text-xs text-emerald-300" role="status">
          Created code <code className="text-emerald-100">{state.code}</code>.
        </p>
      ) : null}
      {state?.ok === false ? (
        <p className="text-xs text-amber-300" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
