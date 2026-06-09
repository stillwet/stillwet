# Deploy on Vercel

This app uses **PostgreSQL** (SQLite is not supported on Vercel serverless). **Neon** is a good default: create a project, set the pooled URL as `DATABASE_URL` and the direct URL as `DIRECT_URL` for local `prisma migrate deploy`.

## Why `npm run build` no longer touches the database

Running `prisma migrate deploy` or `prisma db push` **during** the Vercel build breaks constantly (connection poolers, SSL, cold starts, Prisma engine vs serverless).  

**Default build:** `prisma generate` → `npx next build --webpack` (see `scripts/vercel-build.cjs`). This repo sets a custom `webpack()` hook in `next.config.ts` (dev chunk timeout), so **Next 16’s plain `next build` would error** without `--webpack`. **No DB connection during build.**

You apply the schema **once** (or after schema changes) from your computer using the **same** connection string as production. That is the reliable pattern.

Optional: set **`RUN_PRISMA_SCHEMA_ON_BUILD=1`** in Vercel if you insist on syncing schema during build (you must fix DB URL / pooler issues yourself).

## How Vercel environment variables work

There is **no** separate “Available at Build Time” toggle. For each variable, select **Production** and/or **Preview**; it is available in **both** the build step and runtime for new deployments in that environment. **Redeploy** after edits.

## 1. First-time flow (do this order)

1. **Connect the Git repo** and add env vars (see below).  
2. **Deploy** — the build should go green (no DB in build).  
3. **Apply database schema** (next section) from your laptop.  
4. **Seed** (optional): `npx prisma db seed` with production `DATABASE_URL` / `POSTGRES_PRISMA_URL`.  
5. Open the site.

## 2. Database schema (required — not part of `npm run build`)

From your project folder, with **production** Postgres URL in the environment:

**Fresh Vercel + Neon account:** log into the new Vercel team, **link** the repo project, connect **Neon** under Storage (or paste Neon URLs in Environment Variables), **Redeploy**, then pull env locally (Option B) before migrating.

**Option A — paste URL once (simplest)**

In [Vercel](https://vercel.com) → your project → **Settings → Environment Variables**, copy the value of **`POSTGRES_PRISMA_URL`** or **`POSTGRES_URL_NON_POOLING`** (direct is better for migrate).

PowerShell:

```powershell
cd path\to\StillWetMerch
$env:DATABASE_URL = "paste-copied-url-here"
npx prisma migrate deploy
```

**Option B — Vercel CLI**

```bash
npx vercel login
npx vercel link
npx vercel env pull .env.production.local --environment=production
```

Load that file into your shell (or copy `DATABASE_URL` / `POSTGRES_PRISMA_URL` from it), then `npx prisma migrate deploy`.

**Option C — npm script (recommended after `vercel env pull`)**

Uses Neon's **direct** URL from `.env.production.local` and ignores a local `DIRECT_URL` that sometimes appears in the same file:

```bash
npm run db:migrate:prod
```

If `migrate deploy` fails (e.g. pooled URL only), use:

```powershell
npx prisma db push
```

### Env vars for Postgres (Vercel)

| Name | Purpose |
|------|--------|
| `POSTGRES_PRISMA_URL` | **Runtime** (and CLI fallback) — Vercel Postgres “Prisma” string |
| `DATABASE_URL` | **Runtime** if you set it manually; same idea as above |
| `POSTGRES_URL_NON_POOLING` | **Direct** URL — best for `prisma migrate deploy` from your machine |

`src/lib/prisma.ts` prefers `POSTGRES_PRISMA_URL`, then `DATABASE_URL`.  
`prisma.config.ts` controls CLI (`migrate`, `db push`, `studio`) when run locally.

## 3. What `npm run build` runs

`scripts/vercel-build.cjs`:

1. `npx prisma generate`
2. Schema sync **only if** `RUN_PRISMA_SCHEMA_ON_BUILD=1`
3. `npx next build --webpack`

**Project settings:** **Build Command** should be **`npm run build`** (this repo also sets **`"buildCommand": "npm run build"`** in [`vercel.json`](vercel.json) so the dashboard cannot override it with a raw `next build` that skips `scripts/vercel-build.cjs`). **Install Command** default is fine. **Node.js Version** should match **`package.json` `engines.node`** (22.x); the repo also includes **`.nvmrc`** (`22`) so Vercel can pick the same major version automatically.

### Build failed (`npm run build` exit 1 on Vercel)

1. Open the deploy log and find the **first** error (not only the final exit code).
2. Run **`npm run build`** locally on the **same git commit**. If local passes and Vercel fails: check **Node version** (22), env vars present on Vercel, and **memory** (rare OOM on large Next builds).
3. If the error mentions **Turbopack** vs **webpack**, the deployment is not using the script above — confirm the build command runs **`npm run build`** from the repo root, not a raw `next build` without `--webpack`.
4. **`ENOENT` / `lstat` … `.next/lock`:** Next.js 16 defaults **`experimental.lockDistDir`** to **`true`**, which creates a native lock file under **`.next/lock`** before cleaning the output dir. On Vercel’s filesystem that step can throw **`ENOENT`**. This repo sets **`experimental.lockDistDir: false`** in [`next.config.ts`](next.config.ts) (one build per container — locking is unnecessary). If you still see cache-related `.next` issues, **redeploy with clear build cache** or set **`VERCEL_FORCE_NO_BUILD_CACHE=1`** once; [`scripts/vercel-build.cjs`](scripts/vercel-build.cjs) may also reset `.next` on Vercel before building.

### “Server Action … was not found on the server” (admin save after deploy)

This is **not** a database error. The browser tab still has JavaScript from a **previous** deploy; Server Action IDs change each release.

**Immediate fix:** hard-refresh the admin tab (**Ctrl+Shift+R** / **Cmd+Shift+R**), then save again.

**Production hardening (recommended):**

1. **Vercel → Project → Settings → Skew Protection** — turn **on** (serves prior deployment assets briefly after a new release).
2. **`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`** — add to Vercel **Production** and **Preview** (must be present **at build time**, not only runtime). Generate once:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   Paste the value as the env var, **redeploy**, then hard-refresh admin.
3. This repo sets **`deploymentId`** from **`VERCEL_GIT_COMMIT_SHA`** in [`next.config.ts`](next.config.ts) so Next.js can detect version skew.

If saves still fail **after** a hard refresh, apply pending migrations (new catalog columns `itemCanvasPresentation` / `itemArtworkTemplate` need `20260609120000_admin_catalog_canvas_presentation`):

```bash
npm run db:migrate:prod
```

## 4. Seed data (once)

```bash
# After env pull or DATABASE_URL set to production:
npx prisma db seed
```

**Do not** run `prisma db seed` against production — it deletes orders and products.

### Admin catalog list (creator “Request a catalog listing”)

Creators see allowed listing types from **`AdminCatalogItem`** (`Admin` → **List**). If that table is empty, the dashboard shows “No items to add yet.”

- **Manual:** Add rows under **Admin → List** on production (names, variants, minimum prices).
- **If production already has the sample products from `prisma/seed.ts`** (same slugs: `ceramic-mug-photo`, `canvas-print-12`, etc.), you can insert matching admin rows **once** when the list is still empty:

```bash
npx vercel env pull .env.production.local --environment=production
npm run db:seed:admin-catalog-if-empty
```

The script **no-ops** when any admin catalog row already exists. Slugs live in `src/lib/seed-baseline-admin-catalog.ts`.

## 5. Environment variables (Vercel)

**Project → Settings → Environment Variables** → Production (and Preview if needed) → **Redeploy** after edits.

Names and placeholders: **`.env.example`** in the repo. Additional notes:

- **Postgres:** `DATABASE_URL` is usually Neon **pooled**; use a **direct** URL on your laptop for `prisma migrate deploy` (section 2). Runtime also accepts `POSTGRES_PRISMA_URL` / `POSTGRES_URL` (see `src/lib/env-postgres-url.ts`).
- **`SESSION_SECRET`:** at least **32 characters**, required for admin login. The **shop layout** also opens the cart session on every request; without a valid secret the storefront used to 500 while `/` still loaded. Set this in Production (and Preview) on Vercel.
- **Site gate:** set both `SITE_ACCESS_PASSWORD` and `SITE_ACCESS_SECRET`, or leave the gate off.
- **Shop password reset (Resend):** add `RESEND_API_KEY` (from [Resend](https://resend.com) → API Keys). Verify **`stillwet.com`** in Resend and set `SHOP_PASSWORD_RESET_EMAIL_FROM` to `Still Wet Merch <info@stillwet.com>` (optional override; if unset, the app defaults to the same address). Set **`NEXT_PUBLIC_APP_URL`** to your live `https://…` site so reset links in email point at Vercel, then **Redeploy**.
- **Shop email verification + account deletion:** they use the same Resend key. Account deletion confirmation uses `SHOP_ACCOUNT_DELETION_EMAIL_FROM` if set, otherwise **`SHOP_PASSWORD_RESET_EMAIL_FROM`**, otherwise **`Still Wet Merch <info@stillwet.com>`**. If Resend’s API returns success but mail never arrives, check **Resend → Emails / Logs** (delivery, bounce, suppression) and the recipient’s spam folder.
- **Stripe webhook:** URL in section 6.

**Debug transactional email (no secrets in browser):** open `GET /api/health` on production — JSON includes `passwordReset` and **`accountDeletionEmail`** (`hasVerifiedTransactionalFrom` should be `true` in production). `linkOrigin` must match the URL users use. After forgot-password or account deletion, check **Vercel → Logs** for `shop-password-reset` or **`[shop-account-deletion]`**: Resend HTTP errors, or “Resend accepted email id=…” — then confirm delivery in **Resend → Emails / Logs**. If the UI shows `Email could not be sent`, that text is forwarded from Resend’s API message.

## 6. Stripe webhook

[Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks) → endpoint:

`https://<your-domain>/api/webhooks/stripe`

## 7. Custom domain & HTTPS (padlock / “not secure” / scam warnings)

Browsers show **HTTPS** only when **TLS is terminated correctly** for the hostname you’re visiting. That is almost always **DNS + Vercel**, not application code.

1. **Vercel → Project → Settings → Domains**  
   Add **both** `www.yourdomain.com` and `yourdomain.com` (or whichever you use). Wait until each row shows **Valid Configuration** (not “Invalid” or “Pending”).

2. **DNS at your registrar** (or DNS host) must match **exactly** what Vercel shows for each domain (CNAME / A / ALIAS). If traffic goes to the wrong place, you get **no certificate** or the wrong site → address bar shows **Not secure**.

3. **`NEXT_PUBLIC_APP_URL`** must be your real public URL with **`https://`** (e.g. `https://www.yourdomain.com`). Never `http://` in production.

4. **Cloudflare in front of Vercel**  
   SSL/TLS mode must be **Full** or **Full (strict)** — **not** “Flexible” (that can break HTTPS between Cloudflare and Vercel and confuse browsers).

5. After DNS changes, allow propagation (often minutes, sometimes longer), then open `https://www.yourdomain.com` in a private window.

The app also **redirects HTTP → HTTPS** in production and sends **HSTS** on production deployments; that only helps once requests actually reach your Vercel deployment with a valid certificate.

### Listing artwork upload v2 (`NEXT_PUBLIC_LISTING_ARTWORK_V2=1`)

When enabled, large catalog items (blanket, body pillow, large poster) use **presigned direct-to-R2** uploads — source bytes never pass through Vercel:

- `POST /api/dashboard/listing-artwork/upload/init` — mint presigned PUT (50 MB source cap)
- Browser PUT → R2 `shops/{shopId}/listing-source/{uuid}.ext`
- `POST /api/dashboard/listing-artwork/upload/complete` — Sharp metadata; **24 MP** decode cap for phone-safe items, **~54 MP** for Camera / vector only catalog items (requires `productId`)
- Same-origin `GET /api/dashboard/listing-artwork/source` — compose UI streams source from R2 (no presigned GET / CORS)
- Compose UI + capped client preview (480 px out)
- `POST /api/dashboard/listing-artwork/bake` — pipeline encode from `sourceKey` + transform JSON; deletes source on success

Set **`NEXT_PUBLIC_LISTING_ARTWORK_V2=1`** in Preview/Production env vars to QA. Submit sends only `listingArtworkBakedKey` (no multi-MB FormData).

### Listing artwork bake (`POST /api/dashboard/listing-artwork/bake`)

Server-side crop runs when the creator clicks **Prepare print file** (v2) or **Upload + Crop** (v1), not on listing submit. The route [`src/app/api/dashboard/listing-artwork/bake/route.ts`](src/app/api/dashboard/listing-artwork/bake/route.ts) sets **`maxDuration = 120`** (seconds). Large poster / blanket crops can use significant memory during Sharp encode — on **Vercel Pro**, raise function memory in **Project → Settings → Functions** if bake timeouts or OOM appear in logs. Submit only validates the pre-baked `listing-request/` object key (~10 MB read, no crop RAM).

**QA matrix (v2):** blanket 6400×8400, body pillow 8325×3225 (rotate 90°), large poster 5940×4200 with soft upscale warning — verify bake &lt;120s, output exact px, ≤10 MB, preview matches final.

### Dashboard timeout (“Task timed out after 60s” / 300s)

The shop dashboard does heavy Prisma + promotion work. [`src/app/dashboard/layout.tsx`](src/app/dashboard/layout.tsx) sets `maxDuration` to **300** (seconds) so Vercel can run the RSC to completion on **Pro** and up. In **Vercel → Project → Settings → Functions**, ensure the plan allows that duration (Hobby is still limited to a short window). If timeouts persist, check **Logs** for slow queries or Neon latency.

## Local development

```bash
docker compose up -d
# .env: DATABASE_URL → local Postgres (see .env.example)
npx prisma migrate deploy
npm run db:seed
npm run dev
```

`npm run db:seed` also fills **Admin → List** baseline rows for the sample products when you reset locally.

`npm run build` locally matches Vercel: **no DB** unless `RUN_PRISMA_SCHEMA_ON_BUILD=1`.

## 6. Vercel CPU usage (Hobby)

The creator **dashboard** is optimized to reduce serverless CPU:

- Tab bodies (Listings, Sales, Notifications, Support, Request listing) load via **`GET /api/dashboard/*` on first open**, not on every full `/dashboard` navigation.
- **Sales** uses `ShopSalesDashboardSnapshot`: at most **one live paid-orders query per shop per Pacific calendar day** after the tab is opened.
- **Promotions idle prefetch** is off in production unless `NEXT_PUBLIC_PROMOTIONS_IDLE_PREFETCH=1`.
- **Cron:** one daily admin digest slot (in-app schedule still gates sends); shop promotions snapshot cron removed (webhooks + read-miss backfill).

**Monitor:** Vercel → Project → **Usage** → check **Active CPU** and top function routes. Compare week-over-week after deploy.

**Apply DB migration** (when approved): `ShopSalesDashboardSnapshot` + `ShopOwnerNotice.relatedOrderId` — run `npx prisma migrate deploy` against the target database after pulling env (section 2).
