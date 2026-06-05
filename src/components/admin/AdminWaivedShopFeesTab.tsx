import Link from "next/link";
import { AdminCreatorGiftCodeNotesField } from "@/components/admin/AdminCreatorGiftCodeNotesField";
import { AdminGenerateWaivedShopFeeCodeControls } from "@/components/admin/AdminGenerateWaivedShopFeeCodeControls";
import { AdminWaivedShopFeeDeleteCodeButton } from "@/components/admin/AdminWaivedShopFeeDeleteCodeButton";
import type {
  AdminGiftedShopSetupCodeRow,
  AdminWaivedShopFeeCodeRow,
  AdminWaivedShopFeesDashboardPayload,
} from "@/lib/admin-waived-shop-fees-load";
import type { CreatorGiftCodeUsageStatus } from "@/lib/creator-gift-code-expiration";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function codeStatusBadge(status: CreatorGiftCodeUsageStatus) {
  if (status === "used") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
  if (status === "expired") {
    return "border-zinc-600/40 bg-zinc-800/40 text-zinc-400";
  }
  return "border-amber-500/30 bg-amber-500/10 text-amber-200";
}

function codeStatusLabel(status: CreatorGiftCodeUsageStatus) {
  if (status === "used") return "Used";
  if (status === "expired") return "Expired";
  return "Unused";
}

function AdminProvidedCodeRow(props: { row: AdminWaivedShopFeeCodeRow }) {
  const { row } = props;

  return (
    <div className="grid grid-cols-[1.1fr_0.65fr_1fr_0.9fr_1.2fr_0.55fr] gap-3 border-b border-zinc-900 px-4 py-3 text-sm last:border-b-0">
      <div>
        <code className="text-zinc-200">{row.code}</code>
      </div>
      <div>
        <span
          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${codeStatusBadge(
            row.status,
          )}`}
        >
          {codeStatusLabel(row.status)}
        </span>
      </div>
      <div className="text-zinc-400">
        {row.shopName && row.shopSlug ? (
          <>
            <Link
              href={`/s/${row.shopSlug}`}
              className="font-medium text-zinc-100 hover:underline"
            >
              {row.shopName}
            </Link>
            <p className="mt-1 text-xs text-zinc-500">/{row.shopSlug}</p>
          </>
        ) : (
          "—"
        )}
      </div>
      <div className="text-zinc-400">{formatWhen(row.usedAt)}</div>
      <div>
        <AdminCreatorGiftCodeNotesField codeId={row.codeId} initialNotes={row.adminNotes} />
      </div>
      <div>
        {row.status === "unused" ? (
          <AdminWaivedShopFeeDeleteCodeButton codeId={row.codeId} />
        ) : (
          "—"
        )}
      </div>
    </div>
  );
}

function GiftedCodeRow(props: { row: AdminGiftedShopSetupCodeRow }) {
  const { row } = props;

  return (
    <div className="grid grid-cols-[1.1fr_0.65fr_0.9fr_1fr_0.9fr_1fr] gap-3 border-b border-zinc-900 px-4 py-3 text-sm last:border-b-0">
      <div>
        <code className="text-zinc-200">{row.code}</code>
      </div>
      <div>
        <span
          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${codeStatusBadge(
            row.status,
          )}`}
        >
          {codeStatusLabel(row.status)}
        </span>
      </div>
      <div className="text-zinc-400">{formatWhen(row.expiresAt)}</div>
      <div className="text-zinc-400">
        {row.shopName && row.shopSlug ? (
          <>
            <Link
              href={`/s/${row.shopSlug}`}
              className="font-medium text-zinc-100 hover:underline"
            >
              {row.shopName}
            </Link>
            <p className="mt-1 text-xs text-zinc-500">/{row.shopSlug}</p>
          </>
        ) : (
          "—"
        )}
      </div>
      <div className="text-zinc-400">{formatWhen(row.usedAt)}</div>
      <div className="break-all text-zinc-400">{row.purchaserEmail ?? "—"}</div>
    </div>
  );
}

export function AdminWaivedShopFeesTab(props: { payload: AdminWaivedShopFeesDashboardPayload }) {
  const { adminProvidedCodes, giftedCodes } = props.payload;

  return (
    <section className="space-y-8" aria-label="Waived shop fees">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Waived shop fees
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500">
          Track shop-setup fee waivers from admin invite codes and from purchased creator gifts.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-medium text-zinc-200">Admin provided</h3>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-500">
          Generate invite codes that waive the one-time shop creation fee at signup. These codes do
          not include beta tester perks, listing credits, or other promotions.
        </p>
        <AdminGenerateWaivedShopFeeCodeControls />

        <div className="mt-6">
          <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Invite codes</h4>
          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800">
            <div className="grid grid-cols-[1.1fr_0.65fr_1fr_0.9fr_1.2fr_0.55fr] gap-3 border-b border-zinc-800 bg-zinc-950/80 px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              <span>Code</span>
              <span>Status</span>
              <span>Shop name</span>
              <span>Date used</span>
              <span>Notes</span>
              <span>Delete</span>
            </div>
            {adminProvidedCodes.length === 0 ? (
              <p className="px-4 py-6 text-sm text-zinc-500">No admin-provided waived fee codes yet.</p>
            ) : (
              adminProvidedCodes.map((row) => <AdminProvidedCodeRow key={row.codeId} row={row} />)
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-zinc-200">Gifted codes</h3>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-500">
          Shop setup fee codes from paid creator gift purchases. Purchased codes expire one year
          after they are issued.
        </p>
        <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800">
          <div className="grid grid-cols-[1.1fr_0.65fr_0.9fr_1fr_0.9fr_1fr] gap-3 border-b border-zinc-800 bg-zinc-950/80 px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            <span>Code</span>
            <span>Status</span>
            <span>Expires</span>
            <span>Shop name</span>
            <span>Date used</span>
            <span>Purchaser email</span>
          </div>
          {giftedCodes.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500">No gifted shop setup codes yet.</p>
          ) : (
            giftedCodes.map((row) => <GiftedCodeRow key={row.codeId} row={row} />)
          )}
        </div>
      </div>
    </section>
  );
}
