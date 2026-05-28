import { NextResponse } from "next/server";
import { pruneBugFeedbackImages } from "@/lib/prune-bug-feedback-images";

function isVercelCron(req: Request) {
  return req.headers.get("x-vercel-cron") === "1";
}

export async function GET(req: Request) {
  // Prefer Vercel Cron header; allow local/manual calls too.
  if (process.env.NODE_ENV === "production" && !isVercelCron(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  const result = await pruneBugFeedbackImages(dryRun);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

