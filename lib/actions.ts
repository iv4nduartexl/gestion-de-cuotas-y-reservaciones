import "server-only";

import { notFound } from "next/navigation";

import type { FieldErrors } from "@/lib/forms";
import { idSchema } from "@/lib/validation/common";
import {
  can,
  getTenantContextOrRedirect,
  type TenantContext,
} from "@/lib/tenant";

export type ActionState = { errors?: FieldErrors; message?: string };

export const FORBIDDEN: ActionState = {
  errors: { form: "No tenés permiso para realizar esta acción." },
};

type Permission = Parameters<typeof can>[1];

/**
 * Start of every tenant server action: resolves the tenant (redirects to
 * sign-in/onboarding if missing), then checks permission and product.
 * Returns null when the user isn't allowed.
 */
export async function authorizeAction(
  permission: Permission,
  { product }: { product?: "appointments" | "memberships" } = {},
): Promise<TenantContext | null> {
  const ctx = await getTenantContextOrRedirect();
  if (!can(ctx, permission)) return null;
  if (product && !isProductEnabled(ctx, product)) return null;
  return ctx;
}

export function isProductEnabled(
  ctx: Pick<TenantContext, "settings">,
  product: "appointments" | "memberships",
) {
  return product === "appointments"
    ? ctx.settings.appointmentsEnabled
    : ctx.settings.membershipsEnabled;
}

/** For pages: 404 when the product is disabled for this business. */
export function requireProduct(
  ctx: Pick<TenantContext, "settings">,
  product: "appointments" | "memberships",
) {
  if (!isProductEnabled(ctx, product)) notFound();
}

/** Validates a route/form id; invalid ids behave like missing records. */
export function parseId(value: unknown): string | null {
  const parsed = idSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
