import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/lib/env";
import * as schema from "./schema";

// Reuse the pool across hot reloads in development.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

const pool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    // Fail fast instead of hanging when the database is unreachable.
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });

if (env.NODE_ENV !== "production") globalForDb.pgPool = pool;

// A broken idle connection (e.g. Postgres restarted) must not crash the app.
pool.on("error", (error) => console.error("Postgres pool error", error));

export const db = drizzle(pool, { schema, casing: "snake_case" });

export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** The pool or an open transaction: lets data functions join a caller's transaction. */
export type Executor = Database | Transaction;
