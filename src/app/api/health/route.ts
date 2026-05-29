import {
  runtimeDatabaseUrlFromEnv,
  runtimeDatabaseUrlSourceKey,
} from "@/lib/env-postgres-url";
import { prisma } from "@/lib/prisma";
import { emailLinkOrigin, publicAppBaseUrl } from "@/lib/public-app-url";

export const runtime = "nodejs";

/**
 * Liveness + quick config hints (no secrets). Use after deploy to confirm DB + env wiring.
 */
export async function GET() {
  const hasDatabaseUrl = Boolean(runtimeDatabaseUrlFromEnv());
  const dbSource = runtimeDatabaseUrlSourceKey();
  let dbOk = false;
  let dbError: string | undefined;
  if (hasDatabaseUrl) {
    try {
      await prisma.$queryRaw`SELECT 1 AS ok`;
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

  return Response.json(
    {
      ok: dbOk,
      hasDatabaseUrl,
      database: {
        ok: dbOk,
        source: dbSource,
        error: dbError,
      },
      appUrl: publicAppBaseUrl() ?? null,
      hasSessionSecret,
      hasAdminPassword,
      passwordReset: {
        hasResendApiKey,
        hasShopPasswordResetFrom,
        linkOrigin: passwordResetLinkOrigin,
      },
      accountDeletionEmail: {
        hasResendApiKey,
        hasShopAccountDeletionFrom,
        hasVerifiedTransactionalFrom,
        linkOrigin: passwordResetLinkOrigin,
      },
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
