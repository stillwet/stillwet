import { NextResponse } from "next/server";
import { processShopInactivityLifecycle } from "@/lib/shop-inactivity-lifecycle";
import { pruneBugFeedbackImages } from "@/lib/prune-bug-feedback-images";
import { pruneRejectedOrderReturnClaimImages } from "@/lib/prune-rejected-order-return-claim-images";
import { cronForbiddenInProduction } from "@/lib/vercel-cron-auth";

export async function GET(req: Request) {
  if (cronForbiddenInProduction(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const [shopInactivity, bugFeedbackImages, rejectedReturnClaimImages] = await Promise.all([
    processShopInactivityLifecycle(),
    pruneBugFeedbackImages(false),
    pruneRejectedOrderReturnClaimImages(false),
  ]);

  const ok =
    bugFeedbackImages.ok && rejectedReturnClaimImages.ok;

  return NextResponse.json({
    ok,
    shopInactivity,
    bugFeedbackImages,
    rejectedReturnClaimImages,
  }, { status: ok ? 200 : 500 });
}
