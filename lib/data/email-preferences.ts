import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { clients, organization } from "@/db/schema";
import { env } from "@/lib/env";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

/**
 * Email preferences from a signed unsubscribe link. The token identifies the
 * client (and so the business); nothing else from the request is trusted.
 */
export async function getEmailPreference(token: string) {
  const clientId = verifyUnsubscribeToken(token, env.BETTER_AUTH_SECRET);
  if (!clientId) return null;
  const [row] = await db
    .select({ clientId: clients.id, clientName: clients.name, optedOutAt: clients.emailOptOutAt, businessName: organization.name })
    .from(clients)
    .innerJoin(organization, eq(organization.id, clients.organizationId))
    .where(eq(clients.id, clientId));
  return row ? { ...row, firstName: row.clientName.split(" ")[0] } : null;
}

/** Stops (or restarts) reminder emails for the client behind the token. */
export async function setEmailOptOut(token: string, optOut: boolean) {
  const clientId = verifyUnsubscribeToken(token, env.BETTER_AUTH_SECRET);
  if (!clientId) return false;
  const updated = await db
    .update(clients)
    .set({ emailOptOutAt: optOut ? new Date() : null })
    .where(eq(clients.id, clientId))
    .returning({ id: clients.id });
  return updated.length > 0;
}
