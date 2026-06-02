/**
 * Local dev: set site-gate + shop owner session cookies and open the dashboard.
 *
 * Uses Docker Postgres (`stillwet_merch`) regardless of Neon vars in `.env`.
 *
 * Usage:
 *   npx tsx scripts/dev-login-shop.ts [shop-slug]
 *
 * Default slug: xtina-test
 */
import "dotenv/config";
import { createServer } from "http";
import { execSync } from "child_process";
import { sealData } from "iron-session";
import { SignJWT } from "jose";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { LOCAL_DOCKER_DATABASE_URL } from "../src/lib/env-postgres-url";
import { SITE_GATE_COOKIE } from "../src/lib/site-gate";

const DEFAULT_SLUG = "xtina-test";
const PORT = 3999;
const APP = "http://localhost:3000";

async function main() {
  const slug = String(process.argv[2] ?? DEFAULT_SLUG).trim();
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    console.error("SESSION_SECRET must be set (32+ chars) in .env");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: LOCAL_DOCKER_DATABASE_URL, max: 2 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const shop = await prisma.shop.findUnique({
      where: { slug },
      select: {
        slug: true,
        displayName: true,
        users: { select: { id: true, email: true }, take: 1 },
      },
    });
    if (!shop?.users[0]) {
      console.error(`No shop owner found for slug "${slug}" in local ${LOCAL_DOCKER_DATABASE_URL}.`);
      console.error("Run: npm run db:up  and ensure xtina-test exists (or npm run db:copy-local).");
      process.exit(1);
    }
    const user = shop.users[0];

    const sealedOwner = await sealData(
      { shopUserId: user.id },
      { password: secret, ttl: 60 * 60 * 24 * 14 },
    );

    const cookies = [`stillwet_shop_owner=${sealedOwner}; Path=/; HttpOnly; SameSite=Lax`];

    const gateSecret = process.env.SITE_ACCESS_SECRET?.trim();
    if (process.env.SITE_ACCESS_PASSWORD?.trim() && gateSecret) {
      const gateToken = await new SignJWT({ site: "stillwet" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("30d")
        .sign(new TextEncoder().encode(gateSecret));
      cookies.push(`${SITE_GATE_COOKIE}=${gateToken}; Path=/; HttpOnly; SameSite=Lax`);
    }

    const loginUrl = `http://localhost:${PORT}/`;
    const server = createServer((_req, res) => {
      res.writeHead(302, {
        "Set-Cookie": cookies,
        Location: `${APP}/dashboard`,
      });
      res.end();
      setTimeout(() => server.close(), 250);
    });

    server.listen(PORT, () => {
      console.info(`Logging in as ${user.email} (${shop.displayName}, /${shop.slug})…`);
      console.info(`Opening ${loginUrl} → ${APP}/dashboard`);
      try {
        execSync(`start "" "${loginUrl}"`, { stdio: "ignore", shell: "cmd.exe" });
      } catch {
        console.info("Could not auto-open browser — visit the URL above manually.");
      }
    });

    await new Promise<void>((resolve) => server.on("close", resolve));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
