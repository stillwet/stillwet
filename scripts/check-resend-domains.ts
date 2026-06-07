/**
 * Read-only: list Resend domains visible to RESEND_API_KEY and show resolved transactional From.
 * Usage: npx tsx scripts/check-resend-domains.ts
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { resolveShopAutomatedTransactionalEmailFrom } from "../src/lib/resend-shop-from";

const root = path.join(__dirname, "..");

function loadEnv(): void {
  // Match Next.js dev: .env → .env.local → .env.development.local (do not let .env.production.local wipe keys).
  for (const file of [".env", ".env.local", ".env.development.local"]) {
    const p = path.join(root, file);
    if (fs.existsSync(p)) dotenv.config({ path: p, override: true });
  }
}

const RESEND_USER_AGENT = "StillWet/1.0 (check-resend-domains)";

async function resendGet(pathname: string, apiKey: string): Promise<Response> {
  return fetch(`https://api.resend.com${pathname}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": RESEND_USER_AGENT,
    },
  });
}

async function main() {
  loadEnv();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set (.env.local or .env.production.local).");
    process.exit(1);
  }

  const keyHint = `${apiKey.slice(0, 6)}…${apiKey.slice(-4)}`;
  console.log(`[resend-check] API key: ${keyHint}`);

  const fromResult = resolveShopAutomatedTransactionalEmailFrom();
  console.log(
    "[resend-check] App would send From:",
    fromResult.ok ? fromResult.from : fromResult.error,
  );

  const listRes = await resendGet("/domains", apiKey);
  const listBody = await listRes.text();
  if (!listRes.ok) {
    console.error(`[resend-check] GET /domains failed ${listRes.status}:`, listBody.slice(0, 500));
    process.exit(1);
  }

  const list = JSON.parse(listBody) as {
    data?: Array<{
      id: string;
      name: string;
      status: string;
      region?: string;
      capabilities?: { sending?: string; receiving?: string };
    }>;
  };

  const domains = list.data ?? [];
  if (domains.length === 0) {
    console.warn("[resend-check] No domains on this Resend account/API key.");
    process.exit(2);
  }

  console.log(`[resend-check] ${domains.length} domain(s) on this API key:\n`);
  for (const d of domains) {
    console.log(`  • ${d.name}`);
    console.log(`    status: ${d.status}`);
    if (d.capabilities) {
      console.log(`    sending: ${d.capabilities.sending ?? "?"}, receiving: ${d.capabilities.receiving ?? "?"}`);
    }
    if (d.region) console.log(`    region: ${d.region}`);

    const detailRes = await resendGet(`/domains/${d.id}`, apiKey);
    if (detailRes.ok) {
      const detail = (await detailRes.json()) as {
        records?: Array<{ record?: string; name?: string; status?: string; type?: string }>;
      };
      const records = detail.records ?? [];
      if (records.length > 0) {
        console.log("    DNS records:");
        for (const r of records) {
          console.log(`      - ${r.record ?? r.type ?? "?"} ${r.name ?? ""}: ${r.status ?? "?"}`);
        }
      }
    }
    console.log("");
  }

  const stillwet = domains.find((d) => d.name === "stillwet.com");
  if (!stillwet) {
    console.warn(
      "[resend-check] stillwet.com is NOT registered on this Resend account. Verify domain on the same team as this API key.",
    );
  } else if (stillwet.status !== "verified") {
    console.warn(
      `[resend-check] stillwet.com status is "${stillwet.status}" — outbound send requires verified (send DNS), not just receive/MX.`,
    );
  } else if (stillwet.capabilities?.sending !== "enabled") {
    console.warn("[resend-check] stillwet.com is verified but sending capability is not enabled.");
  } else {
    console.log("[resend-check] stillwet.com looks OK for sending on this API key.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
