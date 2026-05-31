import pg from "pg";

const ADMIN = "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
const SOURCE = "xtinadom_merch";
const TARGET = "stillwet_merch";

async function terminateDbConnections(client: pg.Client, db: string) {
  await client.query(
    `
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = $1 AND pid <> pg_backend_pid()
  `,
    [db],
  );
}

async function main() {
  const admin = new pg.Client({ connectionString: ADMIN });
  await admin.connect();

  console.log(`[copy-db] Terminating connections to ${TARGET} and ${SOURCE}...`);
  await terminateDbConnections(admin, TARGET);
  await terminateDbConnections(admin, SOURCE);

  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [TARGET]);
  if (exists.rowCount) {
    console.log(`[copy-db] Dropping ${TARGET}...`);
    await admin.query(`DROP DATABASE "${TARGET}" WITH (FORCE)`);
  }

  console.log(`[copy-db] Cloning ${SOURCE} → ${TARGET}...`);
  await admin.query(`CREATE DATABASE "${TARGET}" WITH TEMPLATE "${SOURCE}"`);

  await admin.end();

  const verify = new pg.Client({
    connectionString: `postgresql://postgres:postgres@127.0.0.1:5432/${TARGET}`,
  });
  await verify.connect();
  const shops = await verify.query('SELECT COUNT(*)::int AS n FROM "Shop"');
  const users = await verify.query('SELECT COUNT(*)::int AS n FROM "ShopUser"');
  const slugs = await verify.query(
    'SELECT slug, "displayName" FROM "Shop" WHERE slug <> $1 ORDER BY "createdAt" ASC',
    ["platform"],
  );
  console.log(`[copy-db] ${TARGET}: shops=${shops.rows[0].n} users=${users.rows[0].n}`);
  for (const row of slugs.rows) console.log(`  - /s/${row.slug} (${row.displayName})`);
  await verify.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
