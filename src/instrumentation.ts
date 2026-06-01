export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (process.env.NODE_ENV === "development") {
    // Do not import `@/lib/prisma` here: webpack traces `pg` → `split2` and fails to resolve Node
    // builtins (`stream`) while compiling instrumentation. Prisma connects on first query anyway.
    const { runtimeDatabaseUrlFromEnv } = await import("./lib/env-postgres-url");
    if (!runtimeDatabaseUrlFromEnv()) {
      console.error(
        [
          "",
          "[stillwet] No DATABASE_URL / POSTGRES_PRISMA_URL — set .env or run: npm run db:up",
          "",
        ].join("\n"),
      );
    }
    return;
  }

  const { productionLocalhostDatabaseUrlKeys, runtimeDatabaseUrlFromEnv } =
    await import("./lib/env-postgres-url");
  const ignoredLocalDb = productionLocalhostDatabaseUrlKeys();
  if (ignoredLocalDb.length > 0) {
    console.error(
      `[stillwet] Ignoring localhost Postgres env in production (${ignoredLocalDb.join(", ")}). Use Neon POSTGRES_PRISMA_URL on Vercel — see VERCEL.md.`,
    );
  }
  const dbUrl = runtimeDatabaseUrlFromEnv();
  if (!dbUrl) {
    console.error(
      "[stillwet] No DATABASE_URL or POSTGRES_PRISMA_URL — shop and admin need Postgres. Set env on Vercel and redeploy. See VERCEL.md §5.",
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl && /localhost|127\.0\.0\.1|\[::1\]/i.test(appUrl)) {
    console.error(
      "[stillwet] NEXT_PUBLIC_APP_URL points at localhost in production — set https://stillwet.com on Vercel and redeploy.",
    );
  }

  const gatePwd = process.env.SITE_ACCESS_PASSWORD?.trim();
  const gateSecret = process.env.SITE_ACCESS_SECRET?.trim();
  if (!gatePwd || !gateSecret) {
    console.warn(
      "[stillwet] Site password gate is off — set both SITE_ACCESS_PASSWORD and SITE_ACCESS_SECRET to require /gate before browsing.",
    );
  }
}
