"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { authorizeAction, FORBIDDEN, parseId, type ActionState } from "@/lib/actions";
import { InvalidReferenceError } from "@/lib/data/scope";
import { createStaff, setStaffArchived, updateStaff } from "@/lib/data/staff";
import { isUniqueViolation } from "@/lib/db-errors";
import { withFlash } from "@/lib/flash";
import { parseForm } from "@/lib/forms";
import { staffSchema } from "@/lib/validation/staff";

const APPOINTMENTS = { product: "appointments" } as const;

function staffWriteError(error: unknown): ActionState | null {
  if (isUniqueViolation(error, "staff_memberId_unique")) {
    return { errors: { memberId: "Ese usuario ya está vinculado a otra persona del equipo." } };
  }
  if (error instanceof InvalidReferenceError && error.field === "memberId") {
    return { errors: { memberId: "Usuario inválido." } };
  }
  return null;
}

export async function createStaffAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await authorizeAction({ staff: ["create"] }, APPOINTMENTS);
  if (!ctx) return FORBIDDEN;
  const parsed = parseForm(staffSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };

  let id: string;
  try {
    id = (await createStaff(ctx, parsed.data)).id;
  } catch (error) {
    const state = staffWriteError(error);
    if (state) return state;
    throw error;
  }
  redirect(withFlash(`/dashboard/staff/${id}`, "persona-creada"));
}

export async function updateStaffAction(
  staffId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await authorizeAction({ staff: ["update"] }, APPOINTMENTS);
  if (!ctx) return FORBIDDEN;
  const id = parseId(staffId);
  if (!id) return { errors: { form: "No encontrado." } };
  const parsed = parseForm(staffSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };

  try {
    if (!(await updateStaff(ctx, id, parsed.data))) return { errors: { form: "No encontrado." } };
  } catch (error) {
    const state = staffWriteError(error);
    if (state) return state;
    throw error;
  }
  refresh();
  return { message: "Cambios guardados" };
}

export async function setStaffArchivedAction(staffId: string, archived: boolean) {
  const ctx = await authorizeAction({ staff: ["archive"] }, APPOINTMENTS);
  const id = parseId(staffId);
  if (!ctx || !id) return;
  await setStaffArchived(ctx, id, archived);
  refresh();
}
