/**
 * Insert two demo buyer return claims for admin Returns tab (local / demo).
 *
 * Usage:
 *   npx tsx scripts/seed-demo-return-claims-once.ts --local
 *   npx tsx scripts/seed-demo-return-claims-once.ts
 *
 * Skips if demo claims already exist (adminNotes starts with "[demo]").
 */
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { LOCAL_DOCKER_DATABASE_URL } from "../src/lib/env-postgres-url";
import {
  OrderReturnClaimIssueType,
  OrderReturnClaimStatus,
  OrderStatus,
} from "../src/generated/prisma/enums";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });
dotenv.config({ path: ".env.development.local", override: true });

function applyLocalDatabaseEnv() {
  for (const key of Object.keys(process.env)) {
    if (key.endsWith("_DATABASE_URL") || key.endsWith("_POSTGRES_PRISMA_URL")) {
      delete process.env[key];
    }
  }
  process.env.DATABASE_URL = LOCAL_DOCKER_DATABASE_URL;
  process.env.POSTGRES_PRISMA_URL = LOCAL_DOCKER_DATABASE_URL;
}

if (process.argv.includes("--local")) {
  applyLocalDatabaseEnv();
}

const DEMO_NOTE_PREFIX = "[demo]";

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  const existing = await prisma.orderReturnClaim.count({
    where: { adminNotes: { startsWith: DEMO_NOTE_PREFIX } },
  });
  if (existing >= 2) {
    console.log(`[seed-demo-return-claims] Already have ${existing} demo claim(s); skipping.`);
    return;
  }

  const [orderA, orderB] = await prisma.order.findMany({
    where: { status: OrderStatus.paid },
    orderBy: { createdAt: "desc" },
    take: 2,
    select: {
      id: true,
      orderNumber: true,
      email: true,
      shippingName: true,
      createdAt: true,
    },
  });

  if (!orderA) {
    console.error(
      "[seed-demo-return-claims] No paid orders in this database. Place a test order first, or seed orders.",
    );
    process.exit(1);
  }

  const catalogItems = await prisma.adminCatalogItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    take: 2,
    select: { id: true, name: true },
  });
  if (catalogItems.length === 0) {
    console.error("[seed-demo-return-claims] No admin catalog items. Run admin catalog seed first.");
    process.exit(1);
  }

  const catalogA = catalogItems[0]!;
  const catalogB = catalogItems[1] ?? catalogA;

  const orderForSecond = orderB ?? orderA;

  const demos: {
    order: typeof orderA;
    issueType: OrderReturnClaimIssueType;
    catalog: { id: string; name: string };
    status: OrderReturnClaimStatus;
    email: string;
    nameOnOrder: string;
    cardLast4: string;
    adminNotes: string;
  }[] = [
    {
      order: orderA,
      issueType: OrderReturnClaimIssueType.misprint,
      catalog: catalogA,
      status: OrderReturnClaimStatus.new,
      email: orderA.email?.trim() || "demo.buyer.one@example.com",
      nameOnOrder: orderA.shippingName?.trim() || "Alex Demo",
      cardLast4: "4242",
      adminNotes: `${DEMO_NOTE_PREFIX} Misprint on front print — demo claim for admin Returns tab.`,
    },
    {
      order: orderForSecond,
      issueType: OrderReturnClaimIssueType.defective,
      catalog: catalogB,
      status: OrderReturnClaimStatus.accepted_wip,
      email: orderForSecond.email?.trim() || "demo.buyer.two@example.com",
      nameOnOrder: orderForSecond.shippingName?.trim() || "Jordan Demo",
      cardLast4: "1881",
      adminNotes: `${DEMO_NOTE_PREFIX} Seam defect — demo claim (accepted WIP).`,
    },
  ];

  const toCreate = demos.slice(existing === 1 ? 1 : 0);

  for (const d of toCreate) {
    const claimId = randomUUID();
    const claim = await prisma.orderReturnClaim.create({
      data: {
        id: claimId,
        orderId: d.order.id,
        orderNumber: d.order.orderNumber,
        email: d.email,
        cardLast4: d.cardLast4,
        nameOnOrder: d.nameOnOrder,
        issueType: d.issueType,
        adminCatalogItemId: d.catalog.id,
        catalogItemName: d.catalog.name,
        truthAcknowledged: true,
        replacementPolicyAck: true,
        status: d.status,
        adminNotes: d.adminNotes,
        images: {
          create: [
            {
              id: randomUUID(),
              sortOrder: 0,
              imageUrl: "https://placehold.co/600x600/webp?text=Demo+defect+photo",
              imageR2Key: `returns/claims/${claimId}/0.webp`,
            },
          ],
        },
      },
      select: { id: true, orderNumber: true, status: true, issueType: true },
    });
    console.log(
      `[seed-demo-return-claims] Created claim ${claim.id} — order #${claim.orderNumber}, ${claim.issueType}, ${claim.status}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
