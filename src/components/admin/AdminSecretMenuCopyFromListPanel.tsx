import { adminCopyStandardCatalogToSecretMenu } from "@/actions/admin-secret-menu";

export function AdminSecretMenuCopyFromListPanel(props: {
  standardItemCount: number;
  secretItemCount: number;
  smCopied?: string;
}) {
  const { standardItemCount, secretItemCount, smCopied } = props;
  const canCopyFresh = secretItemCount === 0 && standardItemCount > 0;
  const canReplace = secretItemCount > 0 && standardItemCount > 0;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Bootstrap catalog</h3>
      <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-zinc-600">
        Copy every item from the standard Admin list into this secret menu catalog (names, prices,
        tags, and owned R2 images). Edit secret-menu prices afterward without affecting the public
        list.
      </p>

      {smCopied && smCopied.trim() ? (
        <p
          role="status"
          className="mt-3 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200/90"
        >
          Copied {smCopied} item{smCopied === "1" ? "" : "s"} from the Admin list.
        </p>
      ) : null}

      <p className="mt-3 text-xs text-zinc-500">
        Admin list: {standardItemCount} item{standardItemCount === 1 ? "" : "s"}. Secret menu:{" "}
        {secretItemCount} item{secretItemCount === 1 ? "" : "s"}.
      </p>

      {standardItemCount === 0 ? (
        <p className="mt-3 text-xs text-amber-200/90" role="status">
          Add items on the Admin list tab first.
        </p>
      ) : canCopyFresh ? (
        <form action={adminCopyStandardCatalogToSecretMenu} className="mt-4">
          <button
            type="submit"
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
          >
            Copy Admin list here
          </button>
        </form>
      ) : canReplace ? (
        <form action={adminCopyStandardCatalogToSecretMenu} className="mt-4 space-y-3">
          <p className="text-xs text-amber-200/90" role="status">
            Secret menu already has items. Replace removes them and copies fresh from the Admin list.
          </p>
          <input type="hidden" name="replaceExisting" value="1" />
          <button
            type="submit"
            className="rounded-lg border border-amber-700/60 bg-amber-950/40 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-950/60"
          >
            Replace secret catalog from Admin list
          </button>
        </form>
      ) : null}
    </div>
  );
}
