"use server";

import { revalidatePath } from "next/cache";

import { authorizeAction, FORBIDDEN, type ActionState } from "@/lib/actions";
import { recordAudit } from "@/lib/audit";
import {
  ensureStaffForMember,
  TooManyStaffError,
  updateBookingRules,
  updateBusinessProfile,
  updateBusinessUsage,
  updateMembershipSettings,
  updatePublicProfile,
  updateTeamMode,
} from "@/lib/data/settings";
import { updateReminderSettings } from "@/lib/data/reminders";
import { slugOwner } from "@/lib/data/slugs";
import { isUniqueViolation } from "@/lib/db-errors";
import { parseForm } from "@/lib/forms";
import { bookingRulesSchema, publicProfileSchema } from "@/lib/validation/booking";
import { membershipSettingsSchema } from "@/lib/validation/memberships";
import { reminderSettingsSchema } from "@/lib/validation/reminders";
import { businessProfileSchema, businessUsageSchema, teamModeSchema } from "@/lib/validation/settings";

const SETTINGS = { businessSettings: ["update"] } as const;
const SLUG_TAKEN: ActionState = { errors: { slug: "Ese link ya está en uso. Probá con otro." } };

async function slugTakenByOther(slug: string, organizationId: string) {
  const owner = await slugOwner(slug);
  return owner !== null && owner !== organizationId;
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
  const before = { name: ctx.organization.name, slug: ctx.settings.slug, timezone: ctx.settings.timezone };
  if (before.slug !== parsed.data.slug) {
    await recordAudit(ctx, "settings.slug", null, { from: before.slug, to: parsed.data.slug });
  }
  if (before.name !== parsed.data.name || before.timezone !== parsed.data.timezone) {
    await recordAudit(ctx, "settings.profile", null, { before: { name: before.name, timezone: before.timezone }, after: { name: parsed.data.name, timezone: parsed.data.timezone } });
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
  await recordAudit(ctx, "settings.usage", null, {
    businessType: parsed.data.businessType,
    appointments: parsed.data.appointmentsEnabled,
    memberships: parsed.data.membershipsEnabled,
  });
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
  if (parsed.data.teamMode !== ctx.settings.teamMode) {
    await recordAudit(ctx, "settings.team_mode", null, { to: parsed.data.teamMode });
  }
  revalidatePath("/dashboard", "layout");
  return {
    message: parsed.data.teamMode === "team" ? "Modo equipo activado." : "Modo “trabajo solo/a” activado.",
  };
}

export async function updateBookingRulesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await authorizeAction(SETTINGS, { product: "appointments" });
  if (!ctx) return FORBIDDEN;
  const parsed = parseForm(bookingRulesSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };
  await updateBookingRules(ctx, parsed.data);
  revalidatePath("/dashboard", "layout");
  return { message: "Reglas de reserva guardadas" };
}

export async function updatePublicProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await authorizeAction(SETTINGS);
  if (!ctx) return FORBIDDEN;
  const parsed = parseForm(publicProfileSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };
  await updatePublicProfile(ctx, parsed.data);
  revalidatePath("/dashboard", "layout");
  return { message: "Datos públicos guardados" };
}

export async function updateMembershipSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await authorizeAction(SETTINGS, { product: "memberships" });
  if (!ctx) return FORBIDDEN;
  const parsed = parseForm(membershipSettingsSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };
  await updateMembershipSettings(ctx, parsed.data);
  revalidatePath("/dashboard", "layout");
  return { message: "Configuración de cuotas guardada" };
}

export async function updateReminderSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await authorizeAction(SETTINGS);
  if (!ctx) return FORBIDDEN;
  const parsed = parseForm(reminderSettingsSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };
  // Only touch the settings of products this business uses (the form hides the rest).
  const { settings } = ctx;
  const data = parsed.data;
  await updateReminderSettings(ctx, {
    ...(settings.appointmentsEnabled
      ? {
          remindAppointments24h: data.remindAppointments24h,
          remindAppointments2h: data.remindAppointments2h,
          appointmentReminderTemplate: data.appointmentReminderTemplate,
        }
      : {}),
    ...(settings.membershipsEnabled
      ? {
          remindChargesDaysBefore: data.remindChargesDaysBefore,
          remindChargesOnDue: data.remindChargesOnDue,
          remindChargesDaysAfter: data.remindChargesDaysAfter,
        }
      : {}),
  });
  revalidatePath("/dashboard", "layout");
  return { message: "Recordatorios guardados" };
}
