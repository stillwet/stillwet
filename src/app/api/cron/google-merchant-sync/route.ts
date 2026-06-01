import { NextResponse } from "next/server";
import { reconcileGoogleMerchantEnrollments } from "@/lib/google-merchant/sync";
import { googleMerchantSyncEnabled } from "@/lib/google-merchant/config";
import { cronForbiddenInProduction } from "@/lib/vercel-cron-auth";

export async function GET(req: Request) {
  if (cronForbiddenInProduction(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (!googleMerchantSyncEnabled()) {
    return NextResponse.json({
      ok: true,
      skipped: "Google Merchant sync not configured (set GOOGLE_MERCHANT_SYNC_ENABLED=1 and related env).",
    });
  }

  const result = await reconcileGoogleMerchantEnrollments({
    batchSize: 500,
    pollStatus: true,
  });

  return NextResponse.json(result);
}
