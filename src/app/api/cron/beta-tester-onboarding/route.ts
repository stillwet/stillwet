import { NextResponse } from "next/server";
import { syncBetaTesterOnboardingStatuses } from "@/lib/beta-tester-onboarding-sync";
import { cronForbiddenInProduction } from "@/lib/vercel-cron-auth";

export async function GET(req: Request) {
  if (cronForbiddenInProduction(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const result = await syncBetaTesterOnboardingStatuses();
  return NextResponse.json(result);
}
