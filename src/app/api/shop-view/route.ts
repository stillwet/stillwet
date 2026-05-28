import { NextResponse } from "next/server";
import { StorefrontViewTargetKind } from "@/generated/prisma/enums";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { recordStorefrontViewEvent } from "@/lib/storefront-view-events";

const SLUG_RE = /^[\w-]{1,120}$/i;
const MAX_VIEW_WEIGHT = 20;

function parseViewWeight(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(MAX_VIEW_WEIGHT, Math.max(1, Math.round(n)));
}

/** POST `{ "shopSlug": "..." }` — buffers a view event (rolled up daily). */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const slug = String((body as { shopSlug?: unknown }).shopSlug ?? "").trim();
  if (!slug || !SLUG_RE.test(slug) || slug === PLATFORM_SHOP_SLUG) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const weight = parseViewWeight((body as { weight?: unknown }).weight);

  try {
    const ok = await recordStorefrontViewEvent({
      kind: StorefrontViewTargetKind.shop,
      targetSlug: slug,
      weight,
    });
    return NextResponse.json({ ok });
  } catch (e) {
    console.error("[api/shop-view]", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
