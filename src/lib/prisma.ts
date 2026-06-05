import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import type { PrismaClient } from "@/generated/prisma/client";
import { PrismaClient as PrismaClientConstructor } from "@/generated/prisma/client";
import { runtimeDatabaseUrlFromEnv } from "@/lib/env-postgres-url";

export type PrismaAdminInboundEmailDelegate = PrismaClient["adminInboundEmail"];
export type PrismaModerationKeywordDelegate = PrismaClient["moderationKeyword"];
export type PrismaShopPromotionCreditBalanceDelegate =
  PrismaClient["shopPromotionCreditBalance"];
export type PrismaShopAdminAwardGrantDelegate = PrismaClient["shopAdminAwardGrant"];
export type PrismaAdminNexusRegistrationDatesDelegate =
  PrismaClient["adminNexusRegistrationDates"];

/**
 * Bump when the Prisma schema (or generated client shape) changes so the cached `globalThis` client
 * is dropped — otherwise delegates like `adminCatalogItem` are missing (`findMany` of undefined) or
 * you get unknown-field validation errors. After `npx prisma generate`, bump this and restart dev
 * (or delete `.next`) if needed.
 */
const PRISMA_SINGLETON_STAMP =
  "postgres-adapter-v80-admin-catalog-letterbox-fill";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
  prismaSingletonStamp?: string;
};

/** Next sets this during `next build`; Postgres must not be required at compile time. */
function isNextProductionBuild(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function createPrisma(): PrismaClient {
  const connectionString = runtimeDatabaseUrlFromEnv();
  if (!connectionString) {
    throw new Error(
      "No database URL. Set DATABASE_URL or POSTGRES_PRISMA_URL. Local: npm run db:up then use postgresql://postgres:postgres@127.0.0.1:5432/stillwet_merch",
    );
  }
  if (connectionString.startsWith("file:")) {
    throw new Error(
      "This app uses PostgreSQL only. Update DATABASE_URL to a postgresql://… connection string.",
    );
  }

  const poolMaxDefault = process.env.VERCEL === "1" ? 1 : 10;
  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX ?? poolMaxDefault),
      /** Avoid hanging forever if Postgres is unreachable (Neon/Vercel network issues). */
      connectionTimeoutMillis: Number(
        process.env.PG_CONNECTION_TIMEOUT_MS ?? 15_000,
      ),
    });
  globalForPrisma.pgPool = pool;

  const adapter = new PrismaPg(pool);
  return new PrismaClientConstructor({ adapter });
}

if (globalForPrisma.prismaSingletonStamp !== PRISMA_SINGLETON_STAMP) {
  globalForPrisma.prisma = undefined;
  globalForPrisma.pgPool = undefined;
  globalForPrisma.prismaSingletonStamp = PRISMA_SINGLETON_STAMP;
}

function clientHasRequiredDelegates(client: PrismaClient): boolean {
  const c = client as {
    promotionPurchase?: { findMany?: unknown };
    shopPromotionCreditBalance?: { findMany?: unknown };
    shopAdminAwardGrant?: { findMany?: unknown };
  };
  return (
    typeof c.promotionPurchase?.findMany === "function" &&
    typeof c.shopPromotionCreditBalance?.findMany === "function" &&
    typeof c.shopAdminAwardGrant?.findMany === "function"
  );
}

/**
 * Drops and recreates the Prisma singleton when required delegates are missing (stale codegen / dev HMR).
 * Also updates the exported {@link prisma} binding — must not use `export const prisma` or importers keep
 * a stale object reference forever.
 */
function reconcilePrismaSingleton(): PrismaClient {
  let client = globalForPrisma.prisma ?? createPrisma();

  if (!clientHasRequiredDelegates(client)) {
    globalForPrisma.prisma = undefined;
    client = createPrisma();
    if (!clientHasRequiredDelegates(client)) {
      throw new Error(
        "PrismaClient is missing required delegates (promotionPurchase, shopPromotionCreditBalance, shopAdminAwardGrant). Run `npx prisma generate`, ensure src/generated/prisma is up to date, and restart the server.",
      );
    }
  }

  globalForPrisma.prisma = client;
  return client;
}

/**
 * Real `PrismaClient` instance — do not wrap in `Proxy` (breaks Prisma query engine).
 * `let`: {@link reconcilePrismaSingleton} may replace the instance; `export const` would freeze stale refs.
 *
 * Never throw at import time when Postgres is unset — misconfigured Vercel env must not 500 every route
 * (including `/api/health`). Call {@link ensurePrismaClient} before queries at runtime.
 */
export let prisma: PrismaClient;

const dbUrlAtImport = runtimeDatabaseUrlFromEnv();
if (dbUrlAtImport) {
  prisma = reconcilePrismaSingleton();
} else if (process.env.NODE_ENV === "development" && !isNextProductionBuild()) {
  prisma = reconcilePrismaSingleton();
} else {
  prisma = undefined as unknown as PrismaClient;
}

/** Lazily connect when env is fixed or was unavailable at cold-start import. */
export function ensurePrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    prisma = globalForPrisma.prisma;
    return prisma;
  }
  if (!runtimeDatabaseUrlFromEnv()) {
    throw new Error(
      "No database URL. Set POSTGRES_PRISMA_URL or link Neon on Vercel (Production). Remove localhost DATABASE_URL.",
    );
  }
  prisma = reconcilePrismaSingleton();
  return prisma;
}

/**
 * Re-run reconciliation and sync {@link prisma} (call after codegen hot-reloads in rare dev cases).
 */
export function reconcilePrismaAndSyncExport(): PrismaClient {
  const next = reconcilePrismaSingleton();
  prisma = next;
  return next;
}

/**
 * `AdminInboundEmail` was added after some deploys; a long-lived Node process can still hold an older
 * `PrismaClient` without this delegate. Use this helper instead of `prisma.adminInboundEmail` when the
 * process might predate `PRISMA_SINGLETON_STAMP` bumps.
 */
export function prismaAdminInboundEmailOrNull(): PrismaAdminInboundEmailDelegate | null {
  const delegate = (prisma as PrismaClient & { adminInboundEmail?: PrismaAdminInboundEmailDelegate })
    .adminInboundEmail;
  return delegate ?? null;
}

/**
 * Optional delegate — use when `ModerationKeyword` was added after a long-lived process started, or
 * before migration `20260516120000_moderation_keyword` is applied (queries should still no-op gracefully).
 */
export function prismaModerationKeywordOrNull(): PrismaModerationKeywordDelegate | null {
  const delegate = (prisma as PrismaClient & { moderationKeyword?: PrismaModerationKeywordDelegate })
    .moderationKeyword;
  return typeof delegate?.findMany === "function" ? delegate : null;
}

/**
 * Optional delegate — Award Promotions credit balances (migration `20260528160000_shop_admin_award_promotions`).
 */
export function prismaShopPromotionCreditBalanceOrNull(): PrismaShopPromotionCreditBalanceDelegate | null {
  const delegate = (
    prisma as PrismaClient & {
      shopPromotionCreditBalance?: PrismaShopPromotionCreditBalanceDelegate;
    }
  ).shopPromotionCreditBalance;
  return typeof delegate?.findMany === "function" ? delegate : null;
}

/**
 * Optional delegate — Award Promotions admin grant audit log (migration `20260528160000_shop_admin_award_promotions`).
 */
export function prismaShopAdminAwardGrantOrNull(): PrismaShopAdminAwardGrantDelegate | null {
  const delegate = (
    prisma as PrismaClient & { shopAdminAwardGrant?: PrismaShopAdminAwardGrantDelegate }
  ).shopAdminAwardGrant;
  return typeof delegate?.findMany === "function" ? delegate : null;
}

export function adminAwardPromotionsDelegatesReady(): boolean {
  return (
    prismaShopPromotionCreditBalanceOrNull() != null && prismaShopAdminAwardGrantOrNull() != null
  );
}

/**
 * Optional delegate — Nexus planning registered dates (migration `20260603130000_admin_nexus_registration_dates`).
 */
export function prismaAdminNexusRegistrationDatesOrNull(): PrismaAdminNexusRegistrationDatesDelegate | null {
  const client = reconcilePrismaAndSyncExport();
  const delegate = (
    client as PrismaClient & {
      adminNexusRegistrationDates?: PrismaAdminNexusRegistrationDatesDelegate;
    }
  ).adminNexusRegistrationDates;
  return typeof delegate?.findUnique === "function" ? delegate : null;
}
