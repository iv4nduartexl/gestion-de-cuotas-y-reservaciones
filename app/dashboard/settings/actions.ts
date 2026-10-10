"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { businessSettings, organization } from "@/db/schema";
import { authorizeAction, FORBIDDEN, type ActionState } from "@/lib/actions";
import {
  ensureStaffForMember,
  TooManyStaffError,
  updateBusinessProfile,
  updateBusinessUsage,
  updateTeamMode,
} from "@/lib/data/settings";
import { isUniqueViolation } from "@/lib/db-errors";
import { parseForm } from "@/lib/forms";
import { businessProfileSchema, businessUsageSchema, teamModeSchema } from "@/lib/validation/settings";

const SETTINGS = { businessSettings: ["update"] } as const;
const SLUG_TAKEN: ActionState = { errors: { slug: "Ese link ya está en uso. Probá con otro." } };

async function slugTakenByOther(slug: string, organizationId: string) {
  const [org] = await db.select({ id: organization.id }).from(organization).where(eq(organization.slug, slug));
  const [settings] = await db
    .select({ id: businessSettings.organizationId })
    .from(businessSettings)
    .where(eq(businessSettings.slug, slug));
  return (org && org.id !== organizationId) || (settings && settings.id !== organizationId);
}

export async function updateBusinessProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await authorizeAction(SETTINGS);
  if (!ctx) return FORBIDDEN;
  const parsed = parseForm(businessProfileSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };

  if (await slugTakenByOther(parsed.data.slug, ctx.organization.id)) return SLUG_TAKEN;
  try {
    await updateBusinessProfile(ctx, parsed.data);
  } catch (error) {
    if (isUniqueViolation(error)) return SLUG_TAKEN;
    throw error;
  }
  // The name appears in the sidebar and switcher on every page.
  revalidatePath("/dashboard", "layout");
  return { message: "Datos del negocio guardados." };
}

export async function updateBusinessUsageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await authorizeAction(SETTINGS);
  if (!ctx) return FORBIDDEN;
  const parsed = parseForm(businessUsageSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };

  await updateBusinessUsage(ctx, parsed.data);
  if (parsed.data.appointmentsEnabled) {
    // Someone has to take the appointments: start with the current user.
    await ensureStaffForMember(ctx, ctx.memberId, ctx.user.name);
  }
  revalidatePath("/dashboard", "layout");
  return { message: "Cambios guardados." };
}

export async function updateTeamModeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await authorizeAction(SETTINGS, { product: "appointments" });
  if (!ctx) return FORBIDDEN;
  const parsed = parseForm(teamModeSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };

  try {
    await updateTeamMode(ctx, parsed.data.teamMode);
  } catch (error) {
    if (error instanceof TooManyStaffError) {
      return {
        errors: {
          form: "Hay más de una persona activa en tu equipo. Archivá a las demás antes de pasar a “Trabajo solo/a”.",
        },
      };
    }
    throw error;
  }
  revalidatePath("/dashboard", "layout");
  return {
    message: parsed.data.teamMode === "team" ? "Modo equipo activado." : "Modo “trabajo solo/a” activado.",
  };
}
