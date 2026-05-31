import { NextResponse } from "next/server";
import { syncBetaTesterOnboardingStatuses } from "@/lib/beta-tester-onboarding-sync";
import { rebuildPlatformBrowseDailySnapshots } from "@/lib/platform-browse-daily-snapshots";
import { rollupStorefrontViewEvents } from "@/lib/storefront-view-events";
import { cronForbiddenInProduction } from "@/lib/vercel-cron-auth";

export async function GET(req: Request) {
  if (cronForbiddenInProduction(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const [platformSnapshots, viewRollup, betaTesterOnboarding] = await Promise.all([
    rebuildPlatformBrowseDailySnapshots(),
    rollupStorefrontViewEvents(),
    syncBetaTesterOnboardingStatuses(),
  ]);

  if (!platformSnapshots.ok) {
    return NextResponse.json(
      {
        ok: false,
        platformSnapshots: { ok: false, errors: platformSnapshots.errors },
        storefrontViewRollup: viewRollup,
        adminSummaryEmail: { skipped: "disabled" },
        betaTesterOnboarding,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    platformSnapshots: {
      ok: true,
      hotItems: platformSnapshots.hotItems,
      featuredShops: platformSnapshots.featuredShops,
      popularOrder: platformSnapshots.popularOrder,
      storeTags: platformSnapshots.storeTags,
    },
    storefrontViewRollup: viewRollup,
    adminSummaryEmail: { skipped: "disabled" },
    betaTesterOnboarding,
  });
}
