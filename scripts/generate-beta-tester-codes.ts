/**
 * Generate beta-tester shop signup invite codes (CreatorGiftCode shop_setup batch).
 *
 * Usage:
 *   npx tsx scripts/generate-beta-tester-codes.ts [count]
 *
 * Default count: 50. Writes codes to stdout and `beta-tester-codes-<timestamp>.csv`.
 *
 * Requires DATABASE_URL in .env — mutates the database (creates CreatorGiftPurchase + codes).
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createBetaTesterInviteCodes,
  DEFAULT_BETA_TESTER_CODE_COUNT,
} from "../src/lib/beta-tester-codes";
import { prisma } from "../src/lib/prisma";

async function main() {
  const countArg = process.argv[2];
  const count = countArg ? Number.parseInt(countArg, 10) : DEFAULT_BETA_TESTER_CODE_COUNT;
  if (!Number.isFinite(count) || count < 1) {
    console.error("Usage: npx tsx scripts/generate-beta-tester-codes.ts [count]");
    process.exit(1);
  }

  const { purchaseId, codes } = await createBetaTesterInviteCodes(count);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const csvPath = join(process.cwd(), `beta-tester-codes-${stamp}.csv`);
  const csvBody = ["code", ...codes.map((code) => `"${code.replace(/"/g, '""')}"`)].join("\n");
  writeFileSync(csvPath, `${csvBody}\n`, "utf8");

  console.info(`Created beta tester batch purchase ${purchaseId} with ${codes.length} codes.`);
  console.info(`CSV: ${csvPath}`);
  console.info("");
  for (const code of codes) {
    console.info(code);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
