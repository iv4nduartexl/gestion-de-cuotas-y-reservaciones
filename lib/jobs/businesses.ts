import "server-only";

import { eq, or } from "drizzle-orm";

import { db } from "@/db";
import { businessSettings, organization } from "@/db/schema";
import type { TenantScope } from "@/lib/data/scope";

/** Every business that uses at least one product (scheduled jobs iterate these). */
export async function listActiveBusinesses(): Promise<TenantScope[]> {
  return db
    .select({ organization: { id: organization.id, name: organization.name, slug: organization.slug }, settings: businessSettings })
    .from(businessSettings)
    .innerJoin(organization, eq(organization.id, businessSettings.organizationId))
    .where(or(eq(businessSettings.appointmentsEnabled, true), eq(businessSettings.membershipsEnabled, true)));
}
