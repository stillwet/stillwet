import {
  productionLocalhostDatabaseUrlKeys,
  runtimeDatabaseUrlFromEnv,
  runtimeDatabaseUrlSourceKey,
} from "@/lib/env-postgres-url";
import { emailLinkOrigin, publicAppBaseUrl } from "@/lib/public-app-url";
import { resolveShopTransactionalEmailFrom } from "@/lib/resend-shop-from";

export const runtime = "nodejs";

function emailFromDomain(from: string): string | null {
  const match = from.match(/@([^>\s]+)/);
  return match?.[1]?.toLowerCase() ?? null;
}

/**
 * Liveness + quick config hints (no secrets). Use after deploy to confirm DB + env wiring.
 * Does not import `@/lib/prisma` at module load — misconfigured env must still return JSON.
 */
export async function GET() {
  const hasDatabaseUrl = Boolean(runtimeDatabaseUrlFromEnv());
  const dbSource = runtimeDatabaseUrlSourceKey();
  let dbOk = false;
  let dbError: string | undefined;
  if (hasDatabaseUrl) {
    try {
      const { ensurePrismaClient } = await import("@/lib/prisma");
      await ensurePrismaClient().$queryRaw`SELECT 1 AS ok`;
      dbOk = true;
    } catch (e) {
      dbError =
        e instanceof Error
          ? e.message.slice(0, 240)
          : typeof e === "string"
            ? e.slice(0, 240)
            : "query_failed";
    }
  } else {
    dbError = "missing_database_url";
  }

  const hasResendApiKey = Boolean(process.env.RESEND_API_KEY?.trim());
  const hasShopPasswordResetFrom = Boolean(process.env.SHOP_PASSWORD_RESET_EMAIL_FROM?.trim());
  const hasShopAccountDeletionFrom = Boolean(process.env.SHOP_ACCOUNT_DELETION_EMAIL_FROM?.trim());
  const hasVerifiedTransactionalFrom =
    hasShopPasswordResetFrom ||
    hasShopAccountDeletionFrom ||
    Boolean(process.env.SHOP_EMAIL_VERIFICATION_EMAIL_FROM?.trim());
  const passwordResetLinkOrigin = emailLinkOrigin();
  const hasSessionSecret = (process.env.SESSION_SECRET?.trim().length ?? 0) >= 32;
  const hasAdminPassword = Boolean(process.env.ADMIN_PASSWORD?.trim());
  const localhostDbKeys = productionLocalhostDatabaseUrlKeys();
  const appUrl = publicAppBaseUrl() ?? null;
  const appUrlLooksLocal =
    process.env.NODE_ENV === "production" &&
    Boolean(
      appUrl &&
        /localhost|127\.0\.0\.1|\[::1\]/i.test(appUrl),
    );

  const neonIntegrationKeys = Object.keys(process.env)
    .filter(
      (k) =>
        k.endsWith("_POSTGRES_PRISMA_URL") ||
        k.endsWith("_DATABASE_URL") ||
        k.endsWith("_POSTGRES_URL"),
    )
    .sort();

  const passwordResetFrom = resolveShopTransactionalEmailFrom([
    process.env.SHOP_PASSWORD_RESET_EMAIL_FROM,
  ]);
  const accountDeletionFrom = resolveShopTransactionalEmailFrom([
    process.env.SHOP_PASSWORD_RESET_EMAIL_FROM,
    process.env.SHOP_ACCOUNT_DELETION_EMAIL_FROM,
  ]);
  const passwordResetFromDomain =
    passwordResetFrom.ok ? emailFromDomain(passwordResetFrom.from) : null;
  const accountDeletionFromDomain =
    accountDeletionFrom.ok ? emailFromDomain(accountDeletionFrom.from) : null;

  return Response.json(
    {
      ok: dbOk,
      hasDatabaseUrl,
      database: {
        ok: dbOk,
        source: dbSource,
        error: dbError,
        ignoredLocalhostEnvKeys: localhostDbKeys.length > 0 ? localhostDbKeys : undefined,
        neonIntegrationEnvKeys:
          neonIntegrationKeys.length > 0 ? neonIntegrationKeys : undefined,
      },
      configWarnings:
        localhostDbKeys.length > 0 || appUrlLooksLocal || !hasDatabaseUrl
          ? {
              localhostDatabaseUrlEnvKeys: localhostDbKeys.length > 0 ? localhostDbKeys : undefined,
              appUrlLooksLocal: appUrlLooksLocal || undefined,
              missingDatabaseUrl: !hasDatabaseUrl || undefined,
              hint:
                "In Vercel → Production (project that owns stillwet.com): delete localhost DATABASE_URL, link Neon or set POSTGRES_PRISMA_URL, set NEXT_PUBLIC_APP_URL=https://stillwet.com, redeploy.",
            }
          : undefined,
      appUrl,
      hasSessionSecret,
      hasAdminPassword,
      passwordReset: {
        hasResendApiKey,
        hasShopPasswordResetFrom,
        resolvedFromDomain: passwordResetFromDomain,
        linkOrigin: passwordResetLinkOrigin,
      },
      accountDeletionEmail: {
        hasResendApiKey,
        hasShopAccountDeletionFrom,
        hasVerifiedTransactionalFrom,
        resolvedFromDomain: accountDeletionFromDomain,
        linkOrigin: passwordResetLinkOrigin,
      },
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
