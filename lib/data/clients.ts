import "server-only";

import { and, asc, count, eq, ilike, isNotNull, isNull, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { clients } from "@/db/schema";
import type { ClientInput } from "@/lib/validation/clients";
import { likePattern, PAGE_SIZE, type TenantScope } from "./scope";

export type Client = typeof clients.$inferSelect;

function scoped(ctx: TenantScope, ...conditions: (SQL | undefined)[]) {
  return and(eq(clients.organizationId, ctx.organization.id), ...conditions);
}

export async function listClients(
  ctx: TenantScope,
  { q = "", page = 1, archived = false }: { q?: string; page?: number; archived?: boolean } = {},
) {
  const search = q.trim();
  // "0981 123" should match "+595981123...": compare digits without leading 0.
  const digits = search.replace(/\D/g, "").replace(/^0+/, "");
  const where = scoped(
    ctx,
    archived ? isNotNull(clients.archivedAt) : isNull(clients.archivedAt),
    search
      ? or(
          ilike(clients.name, likePattern(search)),
          ilike(clients.email, likePattern(search)),
          ilike(clients.documentNumber, likePattern(search)),
          digits.length >= 3 ? ilike(clients.phone, likePattern(digits)) : undefined,
        )
      : undefined,
  );

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(clients)
      .where(where)
      .orderBy(asc(clients.name), asc(clients.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(clients).where(where),
  ]);
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getClient(ctx: TenantScope, id: string): Promise<Client | null> {
  const [row] = await db.select().from(clients).where(scoped(ctx, eq(clients.id, id)));
  return row ?? null;
}

export async function createClient(ctx: TenantScope, input: ClientInput) {
  const [row] = await db
    .insert(clients)
    .values({ ...input, organizationId: ctx.organization.id })
    .returning();
  return row;
}

export async function updateClient(ctx: TenantScope, id: string, input: ClientInput) {
  const [row] = await db
    .update(clients)
    .set(input)
    .where(scoped(ctx, eq(clients.id, id)))
    .returning();
  return row ?? null;
}

export async function setClientArchived(ctx: TenantScope, id: string, archived: boolean) {
  const rows = await db
    .update(clients)
    .set({ archivedAt: archived ? new Date() : null })
    .where(scoped(ctx, eq(clients.id, id)))
    .returning({ id: clients.id });
  return rows.length > 0;
}
