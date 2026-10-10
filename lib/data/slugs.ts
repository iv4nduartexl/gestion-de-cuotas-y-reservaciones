import "server-only";

import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { businessSettings, organization, slugRedirects } from "@/db/schema";

/**
 * Which business owns a public link: as its current slug, or as an old one
 * that still redirects. Old links stay reserved so a shared link never
 * starts pointing to another business.
 */
export async function slugOwner(slug: string): Promise<string | null> {
  const [current] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);
  if (current) return current.id;
  const [settings] = await db
    .select({ id: businessSettings.organizationId })
    .from(businessSettings)
    .where(eq(businessSettings.slug, slug))
    .limit(1);
  if (settings) return settings.id;
  const [redirect] = await db
    .select({ id: slugRedirects.organizationId })
    .from(slugRedirects)
    .where(eq(slugRedirects.slug, slug))
    .limit(1);
  return redirect?.id ?? null;
}

/** The current slug for an old one, or null if it isn't an old link. */
export async function redirectedSlug(oldSlug: string): Promise<string | null> {
  const [row] = await db
    .select({ slug: businessSettings.slug })
    .from(slugRedirects)
    .innerJoin(businessSettings, eq(businessSettings.organizationId, slugRedirects.organizationId))
    .where(and(eq(slugRedirects.slug, oldSlug), ne(businessSettings.slug, oldSlug)))
    .limit(1);
  return row?.slug ?? null;
}
