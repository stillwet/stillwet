import dotenv from "dotenv";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { listingArtworkUseServerSideCrop } from "../src/lib/listing-artwork-browser-crop-threshold";

async function main() {
dotenv.config({ path: path.join(__dirname, "..", ".env") });
const dbUrl = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_PRISMA_URL?.trim();
if (!dbUrl) throw new Error("DATABASE_URL not set");
const pool = new pg.Pool({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const items = await prisma.adminCatalogItem.findMany({
  orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  select: {
    id: true,
    name: true,
    itemPrintAreaWidthPx: true,
    itemPrintAreaHeightPx: true,
    itemMinArtworkDpi: true,
    itemMinPriceCents: true,
  },
});

type Row = {
  name: string;
  printW: number | null;
  printH: number | null;
  megapixels: number | null;
  hasPrintCrop: boolean;
  serverCropAtMaxUpload: boolean;
  issue: string | null;
};

const rows: Row[] = [];
for (const i of items) {
  const w = i.itemPrintAreaWidthPx;
  const h = i.itemPrintAreaHeightPx;
  const hasPrintCrop = w != null && h != null && w > 0 && h > 0;
  const megapixels = hasPrintCrop ? (w * h) / 1_000_000 : null;
  const serverAt1mb = hasPrintCrop ? listingArtworkUseServerSideCrop(w, h, 1 * 1024 * 1024) : false;

  let issue: string | null = null;
  if (!hasPrintCrop) {
    issue = "missing print dimensions — no crop template";
  } else if (!serverAt1mb) {
    issue = "browser crop — should use server for all print templates";
  }

  rows.push({
    name: i.name,
    printW: hasPrintCrop ? w : null,
    printH: hasPrintCrop ? h : null,
    megapixels,
    hasPrintCrop,
    serverCropAtMaxUpload: serverAt1mb,
    issue,
  });
}

console.log("Admin catalog upload audit\n");
for (const r of rows) {
  const dims = r.hasPrintCrop ? `${r.printW}×${r.printH} (${r.megapixels?.toFixed(2)} MP)` : "—";
  const path = r.hasPrintCrop ? (r.serverCropAtMaxUpload ? "server@1mb" : "browser@1mb") : "no-crop";
  const flag = r.issue ? ` ⚠ ${r.issue}` : " ✓";
  console.log(`${r.name}: ${dims} → ${path}${flag}`);
}

const problems = rows.filter((r) => r.issue);
console.log(`\n${rows.length} items, ${problems.length} flagged`);

await prisma.$disconnect();
await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
