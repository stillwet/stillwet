import { NextResponse } from "next/server";
import { pruneRejectedOrderReturnClaimImages } from "@/lib/prune-rejected-order-return-claim-images";

function isVercelCron(req: Request) {
  return req.headers.get("x-vercel-cron") === "1";
}

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production" && !isVercelCron(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  const result = await pruneRejectedOrderReturnClaimImages(dryRun);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
