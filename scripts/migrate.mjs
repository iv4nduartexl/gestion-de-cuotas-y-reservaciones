// Applies pending database migrations (production and Docker). Uses the
// programmatic migrator: `drizzle-kit migrate` can fail without a non-zero
// exit code. Reads DATABASE_URL from the environment; exits 1 on failure.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const migrationsFolder = process.env.MIGRATIONS_FOLDER ?? "db/migrations";
const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  // Only one runner at a time, even if two deploys overlap.
  await client.query("select pg_advisory_lock(hashtext('agenda:migrations'))");
  await migrate(drizzle(client), { migrationsFolder });
  console.log("Migrations applied.");
} catch (error) {
  console.error("Migration failed:", error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
