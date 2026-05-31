"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  adminRevokeAwardGrant,
  type AdminRevokeAwardGrantResult,
} from "@/actions/admin-award-promotions";

export function AdminRevokeAwardGrantButton(props: {
  grantId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    AdminRevokeAwardGrantResult | undefined,
    FormData
  >(async (_prev, formData) => {
    const result = await adminRevokeAwardGrant(formData);
    if (result.ok) router.refresh();
    return result;
  }, undefined);

  if (props.disabled) return null;

  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="grantId" value={props.grantId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-amber-800/70 bg-amber-950/40 px-2 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-900/50 disabled:opacity-50"
      >
        {pending ? "Revoking…" : "Revoke"}
      </button>
      {state?.ok === false ? (
        <p className="mt-1 max-w-[12rem] text-[10px] text-amber-300" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
