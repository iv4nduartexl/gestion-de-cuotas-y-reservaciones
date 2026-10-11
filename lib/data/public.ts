import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { businessSettings, organization } from "@/db/schema";
import { listActiveStaffNames, listBookableServices } from "@/lib/booking";
import { staffWithHours } from "./availability";
import { findServiceProblems } from "./services";
import { listStayServices } from "./stays";
import type { TenantScope } from "./scope";

/**
 * A business as seen from its public booking page. Resolved from the URL slug
 * on the server; the same shape as the dashboard's tenant scope, so the data
 * layer stays scoped to one organization.
 */
export type PublicBusiness = TenantScope;

export async function getPublicBusiness(slug: string): Promise<PublicBusiness | null> {
  const [row] = await db
    .select({ organization: { id: organization.id, name: organization.name, slug: organization.slug }, settings: businessSettings })
    .from(businessSettings)
    .innerJoin(organization, eq(organization.id, businessSettings.organizationId))
    .where(and(eq(businessSettings.slug, slug), eq(businessSettings.appointmentsEnabled, true)));
  return row ?? null;
}

/** Services that can actually be booked: they have staff, and that staff has hours. */
export async function getPublicCatalog(business: PublicBusiness) {
  const services = await listBookableServices(business);
  const allStaffIds = [...new Set(services.flatMap((service) => service.staffIds))];
  const withHours = await staffWithHours(business, allStaffIds);
  const bookable = services
    .map((service) => ({ ...service, staffIds: service.staffIds.filter((id) => withHours.has(id)) }))
    .filter((service) => service.staffIds.length > 0);
  const staffIds = [...new Set(bookable.flatMap((service) => service.staffIds))];
  const [staff, stays, problems] = await Promise.all([
    listActiveStaffNames(business, staffIds),
    listStayServices(business),
    findServiceProblems(business),
  ]);
  // Never offer something that can't actually be booked.
  return {
    services: bookable.filter((service) => !problems.has(service.id)),
    staff,
    stays: stays.filter((stay) => !problems.has(stay.id)),
  };
}
