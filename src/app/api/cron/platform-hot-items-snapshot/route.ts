import { NextResponse } from "next/server";
import { rebuildPlatformBrowseDailySnapshots } from "@/lib/platform-browse-daily-snapshots";

function isVercelCron(req: Request) {
  return req.headers.get("x-vercel-cron") === "1";
}

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production" && !isVercelCron(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const result = await rebuildPlatformBrowseDailySnapshots();
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, errors: result.errors },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    hotItems: result.hotItems,
    featuredShops: result.featuredShops,
    popularOrder: result.popularOrder,
  });
}
