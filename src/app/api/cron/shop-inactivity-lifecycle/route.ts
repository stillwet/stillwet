import { NextResponse } from "next/server";
import { processShopInactivityLifecycle } from "@/lib/shop-inactivity-lifecycle";

function isVercelCron(req: Request) {
  return req.headers.get("x-vercel-cron") === "1";
}

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production" && !isVercelCron(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const result = await processShopInactivityLifecycle();
  return NextResponse.json({ ok: true, ...result });
}
