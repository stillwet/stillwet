import Link from "next/link";
import { AdminBetaTesterDeleteCodeButton } from "@/components/admin/AdminBetaTesterDeleteCodeButton";
import { AdminBetaTesterShopFreezeToggle } from "@/components/admin/AdminBetaTesterShopFreezeToggle";
import { AdminCreatorGiftCodeNotesField } from "@/components/admin/AdminCreatorGiftCodeNotesField";
import { AdminGenerateBetaTesterCodesControls } from "@/components/admin/AdminGenerateBetaTesterCodesControls";
import type { AdminBetaTesterDashboardPayload } from "@/lib/admin-beta-testers-load";
import { BetaTesterOnboardingStatus } from "@/generated/prisma/enums";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function codeStatusBadge(status: "unused" | "used") {
  if (status === "used") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
  return "border-amber-500/30 bg-amber-500/10 text-amber-200";
}

function codeStatusLabel(status: "unused" | "used") {
  return status === "used" ? "Used" : "Unused";
}

function onboardingCompleteLabel(status: BetaTesterOnboardingStatus) {
  return status === BetaTesterOnboardingStatus.complete ? "Yes" : "No";
}

function onboardingCompleteTone(status: BetaTesterOnboardingStatus) {
  if (status === BetaTesterOnboardingStatus.complete) {
    return "text-emerald-200";
  }
  return "text-amber-200";
}

export function AdminBetaTestersTab(props: { payload: AdminBetaTesterDashboardPayload }) {
  const { codes } = props.payload;

  return (
    <section className="space-y-6" aria-label="Beta testers">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Beta testers</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500">
          Shops created with beta-tester invite codes are tagged{" "}
          <span className="text-zinc-300">Beta Tester</span> and automatically receive 10 listing
          credits plus shop flair access. Onboarding status is refreshed once per day by the daily
          maintenance cron.
        </p>
        <AdminGenerateBetaTesterCodesControls />
      </div>

      <div>
        <h3 className="text-sm font-medium text-zinc-200">Code tracker</h3>
        <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800">
          <div className="grid grid-cols-[1fr_0.6fr_1fr_0.85fr_0.75fr_0.9fr_1.2fr_0.5fr] gap-3 border-b border-zinc-800 bg-zinc-950/80 px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            <span>Code</span>
            <span>Status</span>
            <span>Shop name</span>
            <span>Account created</span>
            <span>Onboarding complete</span>
            <span>Frozen</span>
            <span>Notes</span>
            <span>Delete</span>
          </div>
          {codes.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500">No beta tester codes yet.</p>
          ) : (
            codes.map((row) => (
              <div
                key={row.code}
                className="grid grid-cols-[1fr_0.6fr_1fr_0.85fr_0.75fr_0.9fr_1.2fr_0.5fr] gap-3 border-b border-zinc-900 px-4 py-3 text-sm last:border-b-0"
              >
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
                  {row.shopAccount ? (
                    <>
                      <Link
                        href={`/s/${row.shopAccount.slug}`}
                        className="font-medium text-zinc-100 hover:underline"
                      >
                        {row.shopAccount.displayName}
                      </Link>
                      <p className="mt-1 text-xs text-zinc-500">/{row.shopAccount.slug}</p>
                    </>
                  ) : (
                    "—"
                  )}
                </div>
                <div className="text-zinc-400">
                  {row.shopAccount ? formatWhen(row.shopAccount.createdAt) : "—"}
                </div>
                <div className="text-zinc-400">
                  {row.onboardingStatus ? (
                    <>
                      <span
                        className={`font-medium ${onboardingCompleteTone(row.onboardingStatus)}`}
                      >
                        {onboardingCompleteLabel(row.onboardingStatus)}
                      </span>
                      {row.onboardingStatus === BetaTesterOnboardingStatus.complete &&
                      row.onboardingCompletedAt ? (
                        <p className="mt-1 text-xs text-zinc-600">
                          {formatWhen(row.onboardingCompletedAt)}
                        </p>
                      ) : row.incompleteSteps.length > 0 ? (
                        <p className="mt-1 text-xs text-zinc-500">
                          {row.incompleteSteps.join(", ")}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    "—"
                  )}
                </div>
                <div>
                  <AdminBetaTesterShopFreezeToggle
                    shopId={row.shopFreeze?.shopId ?? null}
                    adminFrozenAt={row.shopFreeze?.adminFrozenAt ?? null}
                  />
                </div>
                <div>
                  <AdminCreatorGiftCodeNotesField
                    codeId={row.codeId}
                    initialNotes={row.adminNotes}
                  />
                </div>
                <div>
                  {row.status === "unused" ? (
                    <AdminBetaTesterDeleteCodeButton codeId={row.codeId} />
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
