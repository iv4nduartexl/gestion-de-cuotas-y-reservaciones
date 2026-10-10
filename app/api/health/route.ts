import { sql } from "drizzle-orm";

import { db } from "@/db";

// Liveness + database check for Docker, Caddy and uptime monitors.
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, db: "up" }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
