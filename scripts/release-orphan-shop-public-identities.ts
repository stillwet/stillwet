/**
 * Tombstone slug/displayName on ownerless shops so names are free for new signups.
 *
 *   npx tsx scripts/release-orphan-shop-public-identities.ts
 */

import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local", override: true });

async function main() {
  const { releaseAllOrphanShopPublicIdentities } = await import("../src/lib/shop-public-identity");
  const released = await releaseAllOrphanShopPublicIdentities();
  console.log(`[shop-identity] Released ${released} orphan shop name(s).`);
}

void main().catch((e) => {
  console.error("[shop-identity] Failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
