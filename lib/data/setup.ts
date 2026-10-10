import "server-only";

import { and, count, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { availabilityRules, clients, services, staff } from "@/db/schema";
import type { TenantScope } from "./scope";

/** Counts used by the dashboard's getting-started checklist. */
export async function getSetupStatus(ctx: TenantScope) {
  const org = ctx.organization.id;
  const [[clientCount], [serviceCount], [staffCount], [ruleCount]] = await Promise.all([
    db.select({ n: count() }).from(clients).where(and(eq(clients.organizationId, org), isNull(clients.archivedAt))),
    db.select({ n: count() }).from(services).where(and(eq(services.organizationId, org), isNull(services.archivedAt))),
    db.select({ n: count() }).from(staff).where(and(eq(staff.organizationId, org), isNull(staff.archivedAt))),
    db.select({ n: count() }).from(availabilityRules).where(eq(availabilityRules.organizationId, org)),
  ]);
  return {
    clients: clientCount.n,
    services: serviceCount.n,
    staff: staffCount.n,
    availabilityRules: ruleCount.n,
  };
}
