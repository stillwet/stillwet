<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Prisma

When a task adds or changes `prisma/schema.prisma` and includes new or updated files under `prisma/migrations/`, run **`npx prisma migrate deploy`** after those changes **only if the user approved applying migrations to that database** (with a valid `DATABASE_URL` / `POSTGRES_PRISMA_URL`; see **Database safety (agents)** below). Run **`npx prisma generate`** when the schema or client output changes. Bump `PRISMA_SINGLETON_STAMP` in `src/lib/prisma.ts` if the generated client shape changes so dev does not keep a stale singleton.

## Database safety (agents)

AI agents **must not** perform destructive or data-mutating database operations in **any** environment (local, staging, production) unless the **human explicitly approved that exact operation in the same conversation** (for example: “yes, run `prisma migrate deploy` against production,” or “yes, delete those rows”).

**Forbidden without that explicit approval** (non-exhaustive):

- `prisma migrate reset`, or any command that drops or recreates schemas or wipes data
- `prisma db push` when it could drop columns/tables or otherwise destroy data
- `npm run db:seed`, `prisma db seed`, or other scripts that overwrite or bulk-insert production-like data
- Raw SQL or Prisma calls that **delete, truncate, drop**, or bulk-update rows (`DELETE`, `TRUNCATE`, `DROP`, `$executeRaw` / `$executeRawUnsafe` aimed at mutation, “cleanup” scripts under `scripts/` that change rows, ad-hoc fixes via `psql`)

**Usually allowed without extra approval:**

- **Authoring** migration SQL or schema changes **as files in the repo** for human review (without applying them unless the user approved apply + target)
- **`npx prisma generate`** and read-only inspection of schema/code
- Normal application **read** code paths

If it is unclear whether the user authorized mutating a **real** database, **stop and ask** before running CLI commands, migrations, or scripts.

## Freshness vs speed

Prioritize **fast loads** for marketing and browse surfaces. **Shopping-critical paths must stay accurate:**

- **Cart, checkout, and buyer-facing item prices** — treat as **live**: reads and totals used to purchase must reflect current authoritative data (no stale prices or inventory semantics that could mislead at payment time).
- **Creator shop dashboard sales / metrics** — **not** required to be live; refreshing on the order of **~12 hours** is acceptable unless the product owner asks otherwise.
- **Platform admin dashboard** — sales or financial **tabs should load fresh data when opened** (live for that session/tab load), not a multi-hour cached rollup by default.
- **Search** — stale results are acceptable; **about once per day** freshness for indexes or snapshot-style search is fine unless requirements change.

When adding caches, snapshots, or cron rebuilds, match the surface to these tiers instead of defaulting everything to “live.”

## Shop listings vs Printify

- **`ShopListing`** is one sellable row per `(shopId, productId)` (`@@unique([shopId, productId])`): a single listing in the shop for that catalog / Printify product.
- Each item has **one preset Printify variant** only: `Product.printifyVariantId` (platform catalog) and `ShopListing.listingPrintifyVariantId` (shop listing fulfillment). There are **no buyer-facing options** and **no multi-variant JSON** — one shop price on `ShopListing.priceCents`.
- Dashboard and cart use `src/lib/listing-cart-price.ts` (`listingCartUnitCents`) and `src/lib/printify-variants.ts` (`listingCheckoutPrintifyVariantId`) for checkout fulfillment id resolution.
