import Link from "next/link";
import type { AdminBetaTesterDashboardPayload } from "@/lib/admin-beta-testers-load";
import { BetaTesterOnboardingStatus } from "@/generated/prisma/enums";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusBadge(status: BetaTesterOnboardingStatus) {
  if (status === BetaTesterOnboardingStatus.complete) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
  return "border-amber-500/30 bg-amber-500/10 text-amber-200";
}

function statusLabel(status: BetaTesterOnboardingStatus) {
  return status === BetaTesterOnboardingStatus.complete ? "Complete" : "In progress";
}

export function AdminBetaTestersTab(props: { payload: AdminBetaTesterDashboardPayload }) {
  const { summary, shops, unusedCodes } = props.payload;

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
        <p className="mt-2 text-xs text-zinc-600">
          Generate codes locally:{" "}
          <code className="text-zinc-400">npm run generate:beta-tester-codes</code>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Unused codes", summary.unusedCodes],
          ["Shops signed up", summary.shopsSignedUp],
          ["Onboarding complete", summary.onboardingComplete],
          ["Onboarding in progress", summary.onboardingInProgress],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              {label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">{value}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-medium text-zinc-200">Beta tester shops</h3>
        <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800">
          <div className="grid grid-cols-[1.1fr_0.8fr_0.8fr_1fr_0.9fr] gap-3 border-b border-zinc-800 bg-zinc-950/80 px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            <span>Shop</span>
            <span>Cohort</span>
            <span>Onboarding</span>
            <span>Remaining steps</span>
            <span>Last checked</span>
          </div>
          {shops.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500">No beta tester shops yet.</p>
          ) : (
            shops.map((shop) => (
              <div
                key={shop.shopId}
                className="grid grid-cols-[1.1fr_0.8fr_0.8fr_1fr_0.9fr] gap-3 border-b border-zinc-900 px-4 py-4 text-sm last:border-b-0"
              >
                <div>
                  <Link
                    href={`/s/${shop.slug}`}
                    className="font-medium text-zinc-100 hover:underline"
                  >
                    {shop.displayName}
                  </Link>
                  <p className="mt-1 text-xs text-zinc-500">
                    /{shop.slug}
                    {shop.inviteCode ? (
                      <>
                        {" "}
                        · code <code className="text-zinc-400">{shop.inviteCode}</code>
                      </>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">Signed up {formatWhen(shop.signedUpAt)}</p>
                </div>
                <p className="text-zinc-300">{shop.cohortLabel}</p>
                <div>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${statusBadge(
                      shop.onboardingStatus,
                    )}`}
                  >
                    {statusLabel(shop.onboardingStatus)}
                  </span>
                  {shop.onboardingCompletedAt ? (
                    <p className="mt-2 text-xs text-zinc-600">
                      Completed {formatWhen(shop.onboardingCompletedAt)}
                    </p>
                  ) : null}
                </div>
                <p className="text-sm text-zinc-400">
                  {shop.incompleteSteps.length > 0 ? shop.incompleteSteps.join(", ") : "—"}
                </p>
                <p className="text-sm text-zinc-400">{formatWhen(shop.onboardingCheckedAt)}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-zinc-200">Unused invite codes</h3>
        <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800">
          <div className="grid grid-cols-[1.2fr_0.8fr] gap-3 border-b border-zinc-800 bg-zinc-950/80 px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            <span>Code</span>
            <span>Created</span>
          </div>
          {unusedCodes.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500">No unused beta tester codes.</p>
          ) : (
            unusedCodes.map((row) => (
              <div
                key={row.code}
                className="grid grid-cols-[1.2fr_0.8fr] gap-3 border-b border-zinc-900 px-4 py-3 text-sm last:border-b-0"
              >
                <code className="text-zinc-200">{row.code}</code>
                <span className="text-zinc-500">{formatWhen(row.createdAt)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
