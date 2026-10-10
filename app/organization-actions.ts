"use server";

import { isAPIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { parseForm } from "@/lib/forms";

const schema = z.object({ organizationId: z.string().min(1).max(100) });

/**
 * Switches the active organization. Better Auth verifies membership; the
 * client router cache is purged so no page of the previous business is reused.
 */
export async function setActiveOrganizationAction(formData: FormData) {
  const parsed = parseForm(schema, formData);
  if (!parsed.success) return;
  try {
    await auth.api.setActiveOrganization({
      body: { organizationId: parsed.data.organizationId },
      headers: await headers(),
    });
  } catch (error) {
    if (isAPIError(error)) return;
    throw error;
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
