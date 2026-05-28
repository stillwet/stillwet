import { NextResponse } from "next/server";
import { processShopInactivityLifecycle } from "@/lib/shop-inactivity-lifecycle";
import { pruneBugFeedbackImages } from "@/lib/prune-bug-feedback-images";
import { cronForbiddenInProduction } from "@/lib/vercel-cron-auth";

export async function GET(req: Request) {
  if (cronForbiddenInProduction(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const [shopInactivity, bugFeedbackImages] = await Promise.all([
    processShopInactivityLifecycle(),
    pruneBugFeedbackImages(false),
  ]);

  return NextResponse.json({
    ok: bugFeedbackImages.ok,
    shopInactivity,
    bugFeedbackImages,
  }, { status: bugFeedbackImages.ok ? 200 : 500 });
}
