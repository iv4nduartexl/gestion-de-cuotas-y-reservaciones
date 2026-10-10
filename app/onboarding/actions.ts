"use server";

import { isAPIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { businessSettings, organization, staff } from "@/db/schema";
import { auth } from "@/lib/auth";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { isUniqueViolation } from "@/lib/db-errors";
import { SLUG_MAX_LENGTH, SLUG_MIN_LENGTH, slugify, slugSchema } from "@/lib/slug";
import { parseForm, type FieldErrors } from "@/lib/forms";
import { readSessionUncached } from "@/lib/tenant";
import { createBusinessSchema } from "@/lib/validation/onboarding";

export type CreateBusinessState = { errors?: FieldErrors; message?: string };

const SLUG_TAKEN = "Ese link ya está en uso. Probá con otro.";

// Creates the organization (owner = current user, becomes the active org)
// plus its business_settings row and, for appointments, the owner's staff row. This is the one action that runs before a
// tenant exists, so it authenticates with the session instead of
// getTenantContext().
export async function createBusiness(
  _prev: CreateBusinessState,
  formData: FormData,
): Promise<CreateBusinessState> {
  // Uncached: createOrganization changes the active organization, and the
  // redirect target (/dashboard) renders in this same request.
  const session = await readSessionUncached();
  if (!session) redirect("/sign-in?next=/onboarding");

  const parsed = parseForm(createBusinessSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };
  const {
    businessType,
    name,
    customSlug,
    timezone,
    appointmentsEnabled,
    membershipsEnabled,
    teamMode,
  } = parsed.data;

  let slug: string;
  if (customSlug && parsed.data.slug) {
    slug = parsed.data.slug;
    if (await isSlugTaken(slug)) return { errors: { slug: SLUG_TAKEN } };
  } else {
    const found = await findAvailableSlug(parsed.data.slug || slugFromName(name));
    if (!found) return { errors: { slug: SLUG_TAKEN } };
    slug = found;
  }

  let organizationId: string;
  let ownerMemberId: string | undefined;
  try {
    const created = await auth.api.createOrganization({
      body: { name, slug },
      headers: await headers(),
    });
    if (!created) throw new Error("Organization was not created");
    organizationId = created.id;
    ownerMemberId = created.members[0]?.id;
  } catch (error) {
    if (isAPIError(error) && error.body?.code === "ORGANIZATION_ALREADY_EXISTS") {
      return { errors: { slug: SLUG_TAKEN } };
    }
    throw error;
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(businessSettings).values({
        organizationId,
        slug,
        timezone,
        currency: DEFAULT_CURRENCY,
        appointmentsEnabled,
        membershipsEnabled,
        businessType,
        teamMode: appointmentsEnabled ? teamMode : "solo",
      });
      // The owner usually takes appointments too; they can archive it later.
      if (appointmentsEnabled) {
        await tx.insert(staff).values({
          organizationId,
          name: session.user.name,
          memberId: ownerMemberId,
        });
      }
    });
  } catch (error) {
    // Roll back the organization so we never leave one without settings.
    await db.delete(organization).where(eq(organization.id, organizationId));
    if (isUniqueViolation(error)) return { errors: { slug: SLUG_TAKEN } };
    throw error;
  }

  // The new active organization changes every dashboard page. Purge the
  // client router cache, otherwise it can replay a /dashboard entry cached
  // before onboarding (which redirects back here).
  revalidatePath("/", "layout");
  redirect("/dashboard?bienvenida=1");
}

/** "A" -> "a-negocio"; names that slugify to something too short get a suffix. */
function slugFromName(name: string) {
  const base = slugify(name);
  if (base.length >= SLUG_MIN_LENGTH && slugSchema.safeParse(base).success) return base;
  return slugify(`${base} negocio`) || "mi-negocio";
}

/** base, base-2, base-3... the first one that is free. */
async function findAvailableSlug(base: string) {
  for (let n = 1; n <= 20; n++) {
    const suffix = n === 1 ? "" : `-${n}`;
    const candidate = `${base.slice(0, SLUG_MAX_LENGTH - suffix.length).replace(/-+$/, "")}${suffix}`;
    if (slugSchema.safeParse(candidate).success && !(await isSlugTaken(candidate))) return candidate;
  }
  return null;
}

async function isSlugTaken(slug: string) {
  const [orgMatch, settingsMatch] = await Promise.all([
    db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, slug))
      .limit(1),
    db
      .select({ id: businessSettings.organizationId })
      .from(businessSettings)
      .where(eq(businessSettings.slug, slug))
      .limit(1),
  ]);
  return orgMatch.length > 0 || settingsMatch.length > 0;
}
