import "server-only";

import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { clients, enrollments, paymentProviderAccounts, plans, providerSubscriptions } from "@/db/schema";
import type { TenantScope } from "@/lib/data/scope";
import { env } from "@/lib/env";
import { getPaymentProvider } from "./registry";

/** The online provider a business connected, if any (none today: manual payments). */
async function activeProviderFor(ctx: TenantScope) {
  const [account] = await db
    .select({ provider: paymentProviderAccounts.provider })
    .from(paymentProviderAccounts)
    .where(
      and(
        eq(paymentProviderAccounts.organizationId, ctx.organization.id),
        eq(paymentProviderAccounts.status, "active"),
        ne(paymentProviderAccounts.provider, "manual"),
      ),
    );
  return account ? getPaymentProvider(account.provider) : null;
}

/** Starts automatic billing for an enrollment when the business has a provider. No-op otherwise. */
export async function startProviderSubscription(ctx: TenantScope, enrollmentId: string) {
  const provider = await activeProviderFor(ctx);
  if (!provider) return null;
  const [row] = await db
    .select({ enrollment: enrollments, client: clients, plan: plans })
    .from(enrollments)
    .innerJoin(clients, and(eq(clients.id, enrollments.clientId), eq(clients.organizationId, enrollments.organizationId)))
    .innerJoin(plans, and(eq(plans.id, enrollments.planId), eq(plans.organizationId, enrollments.organizationId)))
    .where(and(eq(enrollments.organizationId, ctx.organization.id), eq(enrollments.id, enrollmentId)));
  if (!row) return null;
  const result = await provider.createSubscription({
    business: { organizationId: ctx.organization.id, name: ctx.organization.name, currency: ctx.settings.currency },
    enrollment: { id: row.enrollment.id, price: row.enrollment.price, startDate: row.enrollment.startDate },
    client: { id: row.client.id, name: row.client.name, email: row.client.email, phone: row.client.phone },
    plan: { name: row.plan.name, intervalUnit: row.plan.intervalUnit, intervalCount: row.plan.intervalCount },
    returnUrl: `${new URL(env.BETTER_AUTH_URL).origin}/dashboard/clients/${row.client.id}`,
  });
  await db.insert(providerSubscriptions).values({
    organizationId: ctx.organization.id,
    enrollmentId,
    provider: provider.id,
    externalId: result.externalId,
    status: result.status,
  });
  return result;
}

/** Stops automatic billing for an enrollment, if it had any. */
export async function cancelProviderSubscriptions(ctx: TenantScope, enrollmentId: string) {
  const rows = await db
    .select()
    .from(providerSubscriptions)
    .where(and(eq(providerSubscriptions.organizationId, ctx.organization.id), eq(providerSubscriptions.enrollmentId, enrollmentId), ne(providerSubscriptions.status, "cancelled")));
  for (const row of rows) {
    await getPaymentProvider(row.provider)?.cancelSubscription({ externalId: row.externalId });
    await db.update(providerSubscriptions).set({ status: "cancelled" }).where(eq(providerSubscriptions.id, row.id));
  }
}
