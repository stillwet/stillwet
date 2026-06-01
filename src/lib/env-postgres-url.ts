// Pooled vs direct URLs: standard env names, then Vercel/Neon integration suffixes.

/** Matches `docker-compose.yml` (postgres:16-alpine). Development only when no env URL is set. */
export const LOCAL_DOCKER_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/stillwet_merch";

function isPostgresUrl(v: string): boolean {
  const t = v.trim();
  return t.startsWith("postgresql://") || t.startsWith("postgres://");
}

let loggedDevDatabaseFallback = false;

/** In development, `localhost` → `127.0.0.1` avoids intermittent ECONNREFUSED on some Windows setups. */
function normalizePostgresUrlForDevelopment(url: string): string {
  if (process.env.NODE_ENV !== "development") return url;
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h === "[::1]" || h === "::1") {
      u.hostname = "127.0.0.1";
      return u.toString();
    }
  } catch {
    /* keep original */
  }
  return url;
}

/**
 * Neon/Vercel pooled URLs sometimes include `channel_binding=require`, which can break `pg` on
 * serverless hosts. Strip it and ensure a connect timeout for cold Neon compute.
 */
function normalizePostgresUrlForServerless(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("channel_binding");
    if (!u.searchParams.has("connect_timeout")) {
      u.searchParams.set("connect_timeout", "15");
    }
    return u.toString();
  } catch {
    return url.replace(/[?&]channel_binding=[^&]*/gi, "").replace(/\?&/, "?");
  }
}

function finalizeRuntimeDatabaseUrl(url: string): string {
  const normalized = normalizePostgresUrlForServerless(url);
  return normalizePostgresUrlForDevelopment(normalized);
}

function isLocalDatabaseHost(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
  } catch {
    return false;
  }
}

function tryRuntimeUrlCandidate(raw: string | undefined): string | undefined {
  const t = raw?.trim();
  if (!t || !isPostgresUrl(t)) return undefined;
  if (process.env.NODE_ENV === "production" && isLocalDatabaseHost(t)) return undefined;
  return t;
}

const RUNTIME_URL_ENV_KEYS = [
  "POSTGRES_PRISMA_URL",
  "DATABASE_URL",
  "POSTGRES_URL",
  "DIRECT_URL",
] as const;

function runtimeDatabaseUrlCandidates(): { key: string; url: string }[] {
  const found: { key: string; url: string }[] = [];
  for (const key of RUNTIME_URL_ENV_KEYS) {
    const url = tryRuntimeUrlCandidate(process.env[key]);
    if (url) found.push({ key, url });
  }
  const integrated = integrationPooledUrlEntry();
  if (integrated) found.push(integrated);
  return found;
}

/** Env vars set to localhost Postgres — ignored in production (see VERCEL.md). */
export function productionLocalhostDatabaseUrlKeys(): string[] {
  if (process.env.NODE_ENV !== "production") return [];
  const keys: string[] = [];
  for (const key of RUNTIME_URL_ENV_KEYS) {
    const raw = process.env[key]?.trim();
    if (raw && isPostgresUrl(raw) && isLocalDatabaseHost(raw)) keys.push(key);
  }
  return keys;
}

/** Which env var supplied the runtime URL (name only — for `/api/health` and logs). */
export function runtimeDatabaseUrlSourceKey(): string | undefined {
  return runtimeDatabaseUrlCandidates()[0]?.key;
}

export function runtimeDatabaseUrlFromEnv(): string | undefined {
  const chosen = runtimeDatabaseUrlCandidates()[0];
  if (chosen) {
    return finalizeRuntimeDatabaseUrl(chosen.url);
  }

  if (process.env.NODE_ENV === "development") {
    if (!loggedDevDatabaseFallback) {
      loggedDevDatabaseFallback = true;
      console.info(
        "[stillwet] No DATABASE_URL in env — using Docker Compose default. Start Postgres: npm run db:up",
      );
    }
    return LOCAL_DOCKER_DATABASE_URL;
  }

  return undefined;
}

const SUFFIX_PRISMA = "_POSTGRES_PRISMA_URL";
const SUFFIX_DB = "_DATABASE_URL";

function integrationPooledUrlEntry(): { key: string; url: string } | undefined {
  const found: { key: string; url: string }[] = [];
  for (const [k, v] of Object.entries(process.env)) {
    if (!v?.trim() || !isPostgresUrl(v)) continue;
    if (
      (k.length > SUFFIX_PRISMA.length && k.endsWith(SUFFIX_PRISMA)) ||
      (k.length > SUFFIX_DB.length && k.endsWith(SUFFIX_DB))
    ) {
      found.push({ key: k, url: v.trim() });
    }
  }
  if (found.length === 0) return undefined;
  found.sort((a, b) => a.key.localeCompare(b.key));
  if (found.length > 1) {
    console.warn(
      `[prisma] Multiple integration pooled URLs (${found.map((f) => f.key).join(", ")}). Using ${found[0].key}.`,
    );
  }
  return found[0];
}

function integrationPooledUrl(): string | undefined {
  return integrationPooledUrlEntry()?.url;
}

const SUFFIX_NON_POOLING = "_POSTGRES_URL_NON_POOLING";
const SUFFIX_UNPOOLED = "_DATABASE_URL_UNPOOLED";

function tryMigrateDirectCandidate(raw: string | undefined): string | undefined {
  const t = raw?.trim();
  if (!t || !isPostgresUrl(t) || isLocalDatabaseHost(t)) return undefined;
  return t;
}

export function migrateDirectUrlFromEnv(): string | undefined {
  const standard =
    tryMigrateDirectCandidate(process.env.PRISMA_MIGRATE_DATABASE_URL) ||
    tryMigrateDirectCandidate(process.env.POSTGRES_URL_NON_POOLING) ||
    tryMigrateDirectCandidate(process.env.DIRECT_URL) ||
    tryMigrateDirectCandidate(process.env.DATABASE_URL_UNPOOLED);
  if (standard) return standard;

  const found: { key: string; url: string }[] = [];
  for (const [k, v] of Object.entries(process.env)) {
    if (!v?.trim() || !isPostgresUrl(v)) continue;
    if (isLocalDatabaseHost(v.trim())) continue;
    if (
      (k.length > SUFFIX_NON_POOLING.length && k.endsWith(SUFFIX_NON_POOLING)) ||
      (k.length > SUFFIX_UNPOOLED.length && k.endsWith(SUFFIX_UNPOOLED))
    ) {
      found.push({ key: k, url: v.trim() });
    }
  }
  if (found.length === 0) return undefined;
  found.sort((a, b) => a.key.localeCompare(b.key));
  if (found.length > 1 && process.env.NODE_ENV === "development") {
    console.warn(
      `[prisma] Multiple integration direct URLs (${found.map((f) => f.key).join(", ")}). Using ${found[0].key}.`,
    );
  }
  return found[0].url;
}
