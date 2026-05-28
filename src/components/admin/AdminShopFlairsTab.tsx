import {
  adminCreateFlairType,
  adminDeleteFlairType,
  adminUpdateFlairType,
} from "@/actions/admin-shop-flairs";

type FlairTypeRow = {
  id: string;
  slug: string;
  label: string;
  sortOrder: number;
  active: boolean;
};

export function AdminShopFlairsTab(props: { types: FlairTypeRow[] }) {
  return (
    <section aria-label="Shop flairs">
      <div className="space-y-10">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Flair types</h2>
          <p className="mt-1 max-w-3xl text-sm text-zinc-400">
            Shops choose one active type for their badge (after purchasing flair access). Disable a type
            to hide it from the picker and storefront.
          </p>

          <form
            className="mt-4 grid max-w-3xl gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 sm:grid-cols-12"
            action={adminCreateFlairType}
          >
            <label className="sm:col-span-5">
              <span className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Display name
              </span>
              <input
                name="label"
                className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                placeholder="Category"
              />
            </label>
            <label className="sm:col-span-4">
              <span className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Slug (optional)
              </span>
              <input
                name="slug"
                className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                placeholder="category"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Sort
              </span>
              <input
                name="sortOrder"
                defaultValue={0}
                className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
              />
            </label>
            <label className="sm:col-span-1 flex items-end gap-2">
              <input name="active" defaultChecked type="checkbox" className="h-4 w-4" />
              <span className="text-sm text-zinc-300">On</span>
            </label>
            <div className="sm:col-span-12 flex items-center justify-end">
              <button className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-800">
                Add type
              </button>
            </div>
          </form>

          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
            <div className="grid grid-cols-12 gap-2 border-b border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <div className="col-span-4">Display name</div>
              <div className="col-span-3">Slug</div>
              <div className="col-span-2">Sort</div>
              <div className="col-span-1">On</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            <div className="divide-y divide-zinc-800">
              {props.types.length === 0 ? (
                <div className="px-3 py-3 text-sm text-zinc-500">No flair types yet.</div>
              ) : (
                props.types.map((t) => (
                  <form
                    key={t.id}
                    className="grid grid-cols-12 gap-2 px-3 py-2"
                    action={adminUpdateFlairType}
                  >
                    <input type="hidden" name="id" value={t.id} />
                    <input
                      name="label"
                      defaultValue={t.label}
                      className="col-span-4 rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1 text-sm text-zinc-100"
                    />
                    <div className="col-span-3 flex items-center text-sm text-zinc-400">
                      <span className="font-mono text-[12px]">{t.slug}</span>
                    </div>
                    <input
                      name="sortOrder"
                      defaultValue={t.sortOrder}
                      className="col-span-2 rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1 text-sm text-zinc-100"
                    />
                    <div className="col-span-1 flex items-center">
                      <input name="active" defaultChecked={t.active} type="checkbox" className="h-4 w-4" />
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <button className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 hover:bg-zinc-800">
                        Save
                      </button>
                      <button
                        formAction={adminDeleteFlairType}
                        className="rounded-md border border-zinc-800 bg-zinc-950/40 px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-900"
                        title="Delete type (clears this flair from any shop using it)"
                      >
                        Delete
                      </button>
                    </div>
                  </form>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
