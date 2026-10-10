// Creates the test database (if missing), applies all migrations and, with
// --reset, empties every table. Reads DATABASE_URL from .env.test.
import nextEnv from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

process.env.NODE_ENV = "test";
nextEnv.loadEnvConfig(process.cwd());

const url = new URL(process.env.DATABASE_URL);
const database = url.pathname.slice(1);
if (!database.endsWith("_test")) {
  throw new Error(`Refusing to use "${database}": test database names must end in _test.`);
}

const adminUrl = new URL(url);
adminUrl.pathname = "/postgres";
const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();
const { rowCount } = await admin.query("select 1 from pg_database where datname = $1", [database]);
if (!rowCount) {
  await admin.query(`create database "${database}"`);
  console.log(`Created database ${database}`);
}
await admin.end();

const pool = new pg.Pool({ connectionString: url.toString() });
await migrate(drizzle(pool), { migrationsFolder: "db/migrations" });
console.log(`Migrated ${database}`);

if (process.argv.includes("--reset")) {
  const { rows } = await pool.query(
    "select tablename from pg_tables where schemaname = 'public'",
  );
  if (rows.length > 0) {
    await pool.query(
      `truncate ${rows.map((row) => `"${row.tablename}"`).join(", ")} restart identity cascade`,
    );
  }
  console.log(`Emptied ${database}`);
}
await pool.end();
