import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { runtimeDatabaseUrlSourceKey } from "@/lib/env-postgres-url";
import { getShopOwnerSession } from "@/lib/session";
import { SITE_GATE_COOKIE } from "@/lib/site-gate";

export const dynamic = "force-dynamic";

/**
 * Local dev only: set shop-owner (and optional site-gate) cookies via iron-session, then redirect to dashboard.
 * Visit: /api/dev/shop-login?slug=xtina-test
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const slug = (url.searchParams.get("slug") ?? "xtina-test").trim();

  const shop = await prisma.shop.findUnique({
    where: { slug },
    select: {
      slug: true,
      displayName: true,
      users: { select: { id: true, email: true }, take: 1 },
    },
  });

  if (!shop?.users[0]) {
    const dbKey = runtimeDatabaseUrlSourceKey() ?? "Docker default (no DATABASE_URL)";
    return NextResponse.json(
      {
        error: `No shop owner for slug "${slug}" in the database this app is using (${dbKey}).`,
        hint: "Run npm run db:up, ensure .env points at local Postgres (not production Neon), or npm run db:copy-local.",
      },
      { status: 404 },
    );
  }

  const session = await getShopOwnerSession();
  session.shopUserId = shop.users[0].id;
  await session.save();

  const dashboard = new URL("/dashboard", url.origin);
  const res = NextResponse.redirect(dashboard);

  const gateSecret = process.env.SITE_ACCESS_SECRET?.trim();
  if (process.env.SITE_ACCESS_PASSWORD?.trim() && gateSecret) {
    const gateToken = await new SignJWT({ site: "stillwet" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(new TextEncoder().encode(gateSecret));
    res.cookies.set(SITE_GATE_COOKIE, gateToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return res;
}
