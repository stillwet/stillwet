"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  adminGenerateBetaTesterCodes,
  type AdminGenerateBetaTesterCodesResult,
} from "@/actions/admin-beta-testers";

function GenerateForm(props: { count: 1 | 10; label: string; pending: boolean; action: (formData: FormData) => void }) {
  return (
    <form action={props.action}>
      <input type="hidden" name="count" value={props.count} />
      <button
        type="submit"
        disabled={props.pending}
        className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
      >
        {props.pending ? "Generating…" : props.label}
      </button>
    </form>
  );
}

export function AdminGenerateBetaTesterCodesControls() {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    AdminGenerateBetaTesterCodesResult | undefined,
    FormData
  >(async (_prev, formData) => {
    const result = await adminGenerateBetaTesterCodes(_prev, formData);
    if (result.ok) router.refresh();
    return result;
  }, undefined);

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <GenerateForm count={1} label="Generate 1 code" pending={pending} action={action} />
        <GenerateForm count={10} label="Generate 10 codes" pending={pending} action={action} />
      </div>
      {state?.ok === true ? (
        <p className="text-xs text-emerald-300" role="status">
          Created {state.count} code{state.count === 1 ? "" : "s"}.
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
