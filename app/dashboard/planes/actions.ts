"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { authorizeAction, FORBIDDEN, parseId, type ActionState } from "@/lib/actions";
import { createPlan, setPlanArchived, updatePlan } from "@/lib/data/plans";
import { withFlash } from "@/lib/flash";
import { parseForm } from "@/lib/forms";
import { planSchema } from "@/lib/validation/memberships";

const MEMBERSHIPS = { product: "memberships" } as const;

export async function createPlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await authorizeAction({ plan: ["create"] }, MEMBERSHIPS);
  if (!ctx) return FORBIDDEN;
  const parsed = parseForm(planSchema(ctx.settings.currency), formData);
  if (!parsed.success) return { errors: parsed.errors };
  await createPlan(ctx, parsed.data);
  redirect(withFlash("/dashboard/planes", "plan-creado"));
}

export async function updatePlanAction(planId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await authorizeAction({ plan: ["update"] }, MEMBERSHIPS);
  if (!ctx) return FORBIDDEN;
  const id = parseId(planId);
  if (!id) return { errors: { form: "Plan no encontrado." } };
  const parsed = parseForm(planSchema(ctx.settings.currency), formData);
  if (!parsed.success) return { errors: parsed.errors };
  if (!(await updatePlan(ctx, id, parsed.data))) return { errors: { form: "Plan no encontrado." } };
  refresh();
  return { message: "Cambios guardados" };
}

export async function setPlanArchivedAction(planId: string, archived: boolean) {
  const ctx = await authorizeAction({ plan: ["archive"] }, MEMBERSHIPS);
  const id = parseId(planId);
  if (!ctx || !id) return;
  await setPlanArchived(ctx, id, archived);
  refresh();
}
