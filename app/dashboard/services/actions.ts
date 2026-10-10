"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { authorizeAction, FORBIDDEN, parseId, type ActionState } from "@/lib/actions";
import { InvalidReferenceError } from "@/lib/data/scope";
import { createService, setServiceArchived, updateService } from "@/lib/data/services";
import { withFlash } from "@/lib/flash";
import { parseForm } from "@/lib/forms";
import { serviceSchema } from "@/lib/validation/services";

const APPOINTMENTS = { product: "appointments" } as const;
const INVALID_STAFF: ActionState = {
  errors: { staffIds: "Alguna de las personas elegidas ya no está disponible." },
};

export async function createServiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await authorizeAction({ service: ["create"] }, APPOINTMENTS);
  if (!ctx) return FORBIDDEN;
  const parsed = parseForm(serviceSchema(ctx.settings.currency), formData, {
    arrays: ["staffIds"],
  });
  if (!parsed.success) return { errors: parsed.errors };

  try {
    await createService(ctx, parsed.data);
  } catch (error) {
    if (error instanceof InvalidReferenceError) return INVALID_STAFF;
    throw error;
  }
  redirect(withFlash("/dashboard/services", "servicio-creado"));
}

export async function updateServiceAction(
  serviceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await authorizeAction({ service: ["update"] }, APPOINTMENTS);
  if (!ctx) return FORBIDDEN;
  const id = parseId(serviceId);
  if (!id) return { errors: { form: "Servicio no encontrado." } };
  const parsed = parseForm(serviceSchema(ctx.settings.currency), formData, {
    arrays: ["staffIds"],
  });
  if (!parsed.success) return { errors: parsed.errors };

  try {
    if (!(await updateService(ctx, id, parsed.data))) {
      return { errors: { form: "Servicio no encontrado." } };
    }
  } catch (error) {
    if (error instanceof InvalidReferenceError) return INVALID_STAFF;
    throw error;
  }
  refresh();
  return { message: "Cambios guardados" };
}

export async function setServiceArchivedAction(serviceId: string, archived: boolean) {
  const ctx = await authorizeAction({ service: ["archive"] }, APPOINTMENTS);
  const id = parseId(serviceId);
  if (!ctx || !id) return;
  await setServiceArchived(ctx, id, archived);
  refresh();
}
