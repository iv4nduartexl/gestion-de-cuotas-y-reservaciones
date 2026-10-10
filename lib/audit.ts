import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import type { AuditAction } from "@/lib/audit-constants";
import type { TenantScope } from "@/lib/data/scope";
import type { TenantContext } from "@/lib/tenant";

/**
 * Records who did a sensitive action. Never throws: a failed audit write is
 * logged but must not undo or block what the user just did.
 */
export async function recordAudit(
  ctx: Pick<TenantContext, "organization" | "user">,
  action: AuditAction,
  target?: { type: string; id: string } | null,
  details?: Record<string, unknown>,
) {
  try {
    await db.insert(auditEvents).values({
      organizationId: ctx.organization.id,
      actorUserId: ctx.user.id,
      actorName: ctx.user.name,
      action,
      targetType: target?.type ?? null,
      targetId: target?.id ?? null,
      details: details ?? null,
    });
  } catch (error) {
    console.error("Failed to record audit event", action, error);
  }
}

/** Latest events of the business (Configuración → Actividad). */
export async function listAuditEvents(ctx: TenantScope, limit = 200) {
  return db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.organizationId, ctx.organization.id))
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);
}
