"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { authorizeAction, FORBIDDEN, parseId, type ActionState } from "@/lib/actions";
import { createClient, setClientArchived, updateClient } from "@/lib/data/clients";
import { todayInZone } from "@/lib/datetime";
import { isUniqueViolation } from "@/lib/db-errors";
import { withFlash } from "@/lib/flash";
import { parseForm } from "@/lib/forms";
import { clientSchema } from "@/lib/validation/clients";

const PHONE_TAKEN: ActionState = {
  errors: { phone: "Ya existe un cliente con ese teléfono." },
};

export async function createClientAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await authorizeAction({ client: ["create"] });
  if (!ctx) return FORBIDDEN;

  const parsed = parseForm(clientSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };

  let id: string;
  try {
    id = (await createClient(ctx, parsed.data)).id;
  } catch (error) {
    if (isUniqueViolation(error, "clients_org_phone_unique")) return PHONE_TAKEN;
    throw error;
  }
  redirect(withFlash(`/dashboard/clients/${id}`, "cliente-creado"));
}

export async function updateClientAction(
  clientId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await authorizeAction({ client: ["update"] });
  if (!ctx) return FORBIDDEN;
  const id = parseId(clientId);
  if (!id) return { errors: { form: "Cliente no encontrado." } };

  const parsed = parseForm(clientSchema, formData);
  if (!parsed.success) return { errors: parsed.errors };

  try {
    const updated = await updateClient(ctx, id, parsed.data);
    if (!updated) return { errors: { form: "Cliente no encontrado." } };
  } catch (error) {
    if (isUniqueViolation(error, "clients_org_phone_unique")) return PHONE_TAKEN;
    throw error;
  }
  refresh();
  return { message: "Cambios guardados" };
}

export async function setClientArchivedAction(clientId: string, archived: boolean) {
  const ctx = await authorizeAction({ client: ["archive"] });
  const id = parseId(clientId);
  if (!ctx || !id) return;
  await setClientArchived(ctx, id, archived, todayInZone(ctx.settings.timezone));
  refresh();
}
