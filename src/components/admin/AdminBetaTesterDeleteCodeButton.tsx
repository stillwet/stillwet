"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  adminDeleteBetaTesterCode,
  type AdminDeleteBetaTesterCodeResult,
} from "@/actions/admin-beta-testers";

export function AdminBetaTesterDeleteCodeButton(props: { codeId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    AdminDeleteBetaTesterCodeResult | undefined,
    FormData
  >(async (_prev, formData) => {
    const result = await adminDeleteBetaTesterCode(_prev, formData);
    if (result.ok) router.refresh();
    return result;
  }, undefined);

  return (
    <form
      action={action}
      className="shrink-0"
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Delete this unused invite code? It will no longer work for shop signup.",
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
