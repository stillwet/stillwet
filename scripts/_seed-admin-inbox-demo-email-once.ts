import dotenv from "dotenv";
import { LOCAL_DOCKER_DATABASE_URL } from "../src/lib/env-postgres-url";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });
dotenv.config({ path: ".env.development.local", override: true });

/** Force Docker Compose Postgres (ignore Neon/Vercel integration URLs in .env). */
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

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { adminInboxEmailAddress } = await import("../src/lib/admin-inbox-config");

  const replied = process.argv.includes("--replied");
  const now = new Date();
  const receivedAt = replied ? new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) : now;

  const row = await prisma.adminInboundEmail.create({
    data: {
      resendEmailId: `demo:local-${replied ? "replied-" : ""}${Date.now()}`,
      fromAddress: replied ? "jordan.demo@example.com" : "alex.demo@example.com",
      toAddress: adminInboxEmailAddress(),
      subject: replied ? "Thanks for the quick reply" : "Question about my order",
      textBody: replied
        ? "Appreciate the help with my shipping question — all set now.\n\nJordan"
        : "Hi — I placed an order last week and have not received a shipping confirmation yet. Can you help?\n\nThanks,\nAlex",
      receivedAt,
      ...(replied ? { repliedAt: new Date(receivedAt.getTime() + 60 * 60 * 1000) } : {}),
    },
  });

  console.log("Demo inbox email created:", row.id);
  console.log("To:", row.toAddress);
  console.log("From:", row.fromAddress);
  console.log("Subject:", row.subject);
  console.log("Replied:", row.repliedAt ? "Yes" : "No");
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
