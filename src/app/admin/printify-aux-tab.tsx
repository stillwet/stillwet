import Link from "next/link";
import { CopyablePrintifyId } from "@/components/admin/CopyablePrintifyId";
import { PrintifyAuxUnpublishForm } from "@/components/admin/PrintifyAuxUnpublishForm";
import { PrintifyAuxUnpublishAllForm } from "@/components/admin/PrintifyAuxUnpublishAllForm";
import { ADMIN_BACKEND_BASE_PATH } from "@/lib/admin-dashboard-urls";
import { pickImageForVariant } from "@/lib/printify-catalog";
import {
  fetchPrintifyCatalog,
  hasPrintifyApiToken,
  isPrintifyAuxShopConfigured,
  printifyAuxShopId,
  printifyPrimaryShopId,
  PRINTIFY_ADMIN_FETCH_TIMEOUT_MS,
} from "@/lib/printify";

export type PrintifyAuxTabProps = {
  unpublish?: string;
  unpublishReason?: string;
  unpublishPrintifyId?: string;
  unpublishDetail?: string;
  unpublishOkCount?: number;
  unpublishFailedCount?: number;
};

function parseUnpublishCount(raw: string | string[] | undefined): number | undefined {
  const s = typeof raw === "string" ? raw : undefined;
  if (!s) return undefined;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : undefined;
}

export function printifyAuxTabPropsFromSearchParams(
  sp: Record<string, string | string[] | undefined>,
): PrintifyAuxTabProps {
  return {
    unpublish: typeof sp.unpublish === "string" ? sp.unpublish : undefined,
    unpublishReason: typeof sp.reason === "string" ? sp.reason : undefined,
    unpublishPrintifyId: typeof sp.printifyId === "string" ? sp.printifyId : undefined,
    unpublishDetail: typeof sp.detail === "string" ? sp.detail : undefined,
    unpublishOkCount: parseUnpublishCount(sp.ok),
    unpublishFailedCount: parseUnpublishCount(sp.failed),
  };
}

export async function PrintifyAuxTab({
  unpublish,
  unpublishReason,
  unpublishPrintifyId,
  unpublishDetail,
  unpublishOkCount,
  unpublishFailedCount,
}: PrintifyAuxTabProps = {}) {
  const auxShopId = printifyAuxShopId();
  const primaryShopId = printifyPrimaryShopId();
  const configured = isPrintifyAuxShopConfigured();
  const tokenSet = hasPrintifyApiToken();

  let catalog: Awaited<ReturnType<typeof fetchPrintifyCatalog>> = [];
  let catalogError: string | null = null;

  if (configured && auxShopId) {
    try {
      catalog = await fetchPrintifyCatalog(auxShopId, {
        timeoutMs: PRINTIFY_ADMIN_FETCH_TIMEOUT_MS,
      });
    } catch (e) {
      catalogError = e instanceof Error ? e.message : String(e);
    }
  }

  return (
    <div className="space-y-10" aria-label="Printify catalogue">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Printify catalogue (unpublish only)
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
          Read-only view of a second Printify shop. Products here are{" "}
          <strong className="font-medium text-zinc-500">not synced</strong> to StillWet and do not appear in shop
          listing requests. Use <strong className="font-medium text-zinc-500">Unpublish</strong> to clear products
          stuck after accidentally clicking Publish in Printify&apos;s dashboard (
          <code className="text-zinc-400">publishing_failed</code> API).
        </p>
        <p className="mt-2 text-xs text-zinc-600">
          Primary fulfillment shop:{" "}
          <Link href={`${ADMIN_BACKEND_BASE_PATH}?tab=printify`} className="text-blue-400/90 hover:underline">
            Printify items
          </Link>
          {" · "}
          <Link href={`${ADMIN_BACKEND_BASE_PATH}?tab=printify-api`} className="text-blue-400/90 hover:underline">
            Printify API
          </Link>
        </p>
      </div>

      {unpublish === "ok" ? (
        <p className="rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200/90">
          Unpublish succeeded
          {unpublishPrintifyId ? (
            <>
              {" "}
              for <code className="text-emerald-100/90">{unpublishPrintifyId}</code>
            </>
          ) : null}
          .
        </p>
      ) : null}

      {unpublish === "all_ok" ? (
        <p className="rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200/90">
          Unpublish all finished: {unpublishOkCount ?? 0} succeeded
          {(unpublishFailedCount ?? 0) > 0 ? `, ${unpublishFailedCount} failed` : ""}.
        </p>
      ) : null}

      {unpublish === "all_partial" ? (
        <p
          role="status"
          className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-200/90"
        >
          Unpublish all finished with errors: {unpublishOkCount ?? 0} succeeded,{" "}
          {unpublishFailedCount ?? 0} failed.
        </p>
      ) : null}

      {unpublish === "all_err" ? (
        <p
          role="alert"
          className="rounded-lg border border-blue-900/50 bg-blue-950/30 px-4 py-3 text-sm text-blue-200/90"
        >
          Unpublish all failed — {unpublishFailedCount ?? 0} product
          {(unpublishFailedCount ?? 0) === 1 ? "" : "s"} could not be unpublished.
        </p>
      ) : null}

      {unpublish === "err" ? (
        <p
          role="alert"
          className="rounded-lg border border-blue-900/50 bg-blue-950/30 px-4 py-3 text-sm text-blue-200/90"
        >
          Unpublish failed
          {unpublishPrintifyId ? (
            <>
              {" "}
              for <code className="text-blue-100/90">{unpublishPrintifyId}</code>
            </>
          ) : null}
          {unpublishReason ? (
            <>
              {" "}
              — <span className="font-mono text-xs">{unpublishReason}</span>
            </>
          ) : null}
          {unpublishDetail ? (
            <>
              {" "}
              <span className="mt-1 block break-all font-mono text-[11px] text-blue-300/80">
                {unpublishDetail}
              </span>
            </>
          ) : null}
          .
        </p>
      ) : null}

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="text-sm font-medium text-zinc-200">Configuration</h3>
        <ul className="mt-3 space-y-2 text-xs text-zinc-500">
          <li>
            <span className="text-zinc-400">PRINTIFY_API_TOKEN</span> —{" "}
            {tokenSet ? "set (hidden)" : "missing"}
          </li>
          <li>
            <span className="text-zinc-400">PRINTIFY_SHOP_ID</span> —{" "}
            {primaryShopId ? (
              <code className="text-zinc-400">{primaryShopId}</code>
            ) : (
              "not set (primary fulfillment)"
            )}
          </li>
          <li>
            <span className="text-zinc-400">PRINTIFY_AUX_SHOP_ID</span> —{" "}
            {auxShopId ? (
              <code className="text-zinc-400">{auxShopId}</code>
            ) : (
              <>
                missing — copy a shop id from{" "}
                <Link
                  href={`${ADMIN_BACKEND_BASE_PATH}?tab=printify-api`}
                  className="text-blue-400/90 hover:underline"
                >
                  Printify API → shops
                </Link>
                , add to <code className="text-zinc-400">.env</code>, restart, and refresh
              </>
            )}
          </li>
        </ul>
        {auxShopId && primaryShopId && auxShopId === primaryShopId ? (
          <p className="mt-4 text-xs text-amber-400/90">
            PRINTIFY_AUX_SHOP_ID must differ from PRINTIFY_SHOP_ID — use a separate Printify shop for cleanup only.
          </p>
        ) : null}
        {!tokenSet ? (
          <p className="mt-4 text-xs text-amber-400/90">
            Set <code className="text-zinc-400">PRINTIFY_API_TOKEN</code> first (same token as the primary shop).
          </p>
        ) : null}
      </section>

      {configured ? (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
              Products in catalogue shop
            </h3>
            {catalog.length > 0 ? <PrintifyAuxUnpublishAllForm productCount={catalog.length} /> : null}
          </div>
          {catalogError ? (
            <p className="mt-2 text-sm text-blue-400/90">{catalogError}</p>
          ) : catalog.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No products returned for this shop.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full min-w-[520px] text-left text-sm text-zinc-300">
                <thead className="border-b border-zinc-800 bg-zinc-950/60 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="p-2 font-medium">Preview</th>
                    <th className="p-2 font-medium">Title</th>
                    <th className="p-2 font-medium">Printify id</th>
                    <th className="p-2 font-medium text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {catalog.map((p) => {
                    const enabledVariants = p.variants.filter((v) => v.enabled);
                    const heroSrc =
                      enabledVariants.length > 0
                        ? pickImageForVariant(p.images, enabledVariants[0]!.id)
                        : (p.images[0]?.src ?? null);
                    return (
                      <tr key={p.id} className="align-top">
                        <td className="p-2">
                          {heroSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={heroSrc}
                              alt=""
                              className="h-14 w-14 rounded border border-zinc-800 object-cover"
                            />
                          ) : (
                            <span className="inline-block h-14 w-14 rounded border border-dashed border-zinc-800 bg-zinc-950/40" />
                          )}
                        </td>
                        <td className="max-w-xs p-2 text-zinc-200">{p.title}</td>
                        <td className="w-40 p-2">
                          <CopyablePrintifyId id={p.id} />
                        </td>
                        <td className="p-2 text-center">
                          <PrintifyAuxUnpublishForm printifyProductId={p.id} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
