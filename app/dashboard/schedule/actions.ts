"use server";

import { refresh } from "next/cache";

import { authorizeAction, FORBIDDEN, parseId, type ActionState } from "@/lib/actions";
import { replaceWeeklySchedule } from "@/lib/data/availability";
import {
  createBlockedSlot,
  createMissingBusinessWideBlocks,
  deleteBlockedSlot,
  getBlockedSlot,
  updateBlockedSlot,
} from "@/lib/data/blocked-slots";
import { InvalidReferenceError } from "@/lib/data/scope";
import { getStaffForMember } from "@/lib/data/staff";
import { addDaysToDate, todayInZone, zonedToUtc } from "@/lib/datetime";
import { isExclusionViolation } from "@/lib/db-errors";
import { parseForm } from "@/lib/forms";
import { paraguayHolidays } from "@/lib/holidays-py";
import type { TenantContext } from "@/lib/tenant";
import { blockedSlotSchema, toInstantRange } from "@/lib/validation/blocked-slots";
import { weeklyScheduleSchema } from "@/lib/validation/staff";

const APPOINTMENTS = { product: "appointments" } as const;

export async function saveWeeklyScheduleAction(
  staffId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await authorizeAction({ availability: ["update"] }, APPOINTMENTS);
  if (!ctx) return FORBIDDEN;
  const id = parseId(staffId);
  if (!id) return { errors: { form: "No encontrado." } };
  const parsed = parseForm(weeklyScheduleSchema, formData);
  if (!parsed.success) {
    return { errors: { form: parsed.errors.schedule ?? "Horario inválido." } };
  }

  try {
    await replaceWeeklySchedule(ctx, id, parsed.data.schedule);
  } catch (error) {
    if (isExclusionViolation(error)) {
      return { errors: { form: "Hay franjas horarias que se superponen." } };
    }
    if (error instanceof InvalidReferenceError) return { errors: { form: "No encontrado." } };
    throw error;
  }
  refresh();
  return { message: "Horario guardado" };
}

/** Members may only manage blocks of their own staff record. */
async function memberMayManage(ctx: TenantContext, staffId: string | null) {
  if (ctx.role !== "member") return true;
  if (!staffId) return false;
  const own = await getStaffForMember(ctx, ctx.memberId);
  return own?.id === staffId;
}

export async function createBlockedSlotAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await authorizeAction({ blockedSlot: ["create"] }, APPOINTMENTS);
  if (!ctx) return FORBIDDEN;
  const parsed = parseForm(blockedSlotSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };
  if (!(await memberMayManage(ctx, parsed.data.staffId))) return FORBIDDEN;

  const { startsAt, endsAt } = toInstantRange(parsed.data, ctx.settings.timezone);
  if (endsAt <= startsAt) {
    return { errors: { endTime: "La hora de fin debe ser posterior a la de inicio." } };
  }
  try {
    await createBlockedSlot(ctx, {
      staffId: parsed.data.staffId,
      startsAt,
      endsAt,
      reason: parsed.data.reason,
    });
  } catch (error) {
    if (error instanceof InvalidReferenceError) {
      return { errors: { staffId: "Elegí una persona válida." } };
    }
    throw error;
  }
  refresh();
  return { message: "Día libre agregado" };
}

/** "Editar" a día libre: new dates, hours or reason. */
export async function updateBlockedSlotAction(blockedSlotId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await authorizeAction({ blockedSlot: ["delete"] }, APPOINTMENTS);
  const id = parseId(blockedSlotId);
  if (!ctx || !id) return FORBIDDEN;
  const slot = await getBlockedSlot(ctx, id);
  if (!slot || !(await memberMayManage(ctx, slot.staffId))) return FORBIDDEN;
  // Who it is for doesn't change here (remove it and add another for that).
  formData.set("staffId", slot.staffId ?? "");
  const parsed = parseForm(blockedSlotSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };
  const { startsAt, endsAt } = toInstantRange(parsed.data, ctx.settings.timezone);
  if (endsAt <= startsAt) return { errors: { endTime: "La hora de fin debe ser posterior a la de inicio." } };
  await updateBlockedSlot(ctx, id, { startsAt, endsAt, reason: parsed.data.reason });
  refresh();
  return { message: "Día libre actualizado" };
}

export async function deleteBlockedSlotAction(blockedSlotId: string) {
  const ctx = await authorizeAction({ blockedSlot: ["delete"] }, APPOINTMENTS);
  const id = parseId(blockedSlotId);
  if (!ctx || !id) return;
  const slot = await getBlockedSlot(ctx, id);
  if (!slot || !(await memberMayManage(ctx, slot.staffId))) return;
  await deleteBlockedSlot(ctx, id);
  refresh();
}

/** Adds this year's (and next year's, near December) national holidays that haven't passed. */
export async function addNationalHolidaysAction(): Promise<ActionState> {
  const ctx = await authorizeAction({ blockedSlot: ["create"] }, APPOINTMENTS);
  if (!ctx || ctx.role === "member") return FORBIDDEN;

  const timeZone = ctx.settings.timezone;
  const today = todayInZone(timeZone);
  const year = Number(today.slice(0, 4));
  const holidays = [...paraguayHolidays(year), ...paraguayHolidays(year + 1)].filter(
    (holiday) => holiday.date >= today && holiday.date <= addDaysToDate(today, 365),
  );
  const added = await createMissingBusinessWideBlocks(
    ctx,
    holidays.map((holiday) => ({
      startsAt: zonedToUtc(holiday.date, "00:00", timeZone),
      endsAt: zonedToUtc(addDaysToDate(holiday.date, 1), "00:00", timeZone),
      reason: `Feriado: ${holiday.name}`,
    })),
  );
  refresh();
  return {
    message:
      added === 0
        ? "Los feriados ya estaban cargados"
        : `Agregamos ${added} feriado${added === 1 ? "" : "s"} de los próximos 12 meses`,
  };
}
