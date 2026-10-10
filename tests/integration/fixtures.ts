import { randomUUID } from "node:crypto";

import type { Pool } from "pg";
import { afterAll } from "vitest";

import { db } from "@/db";
import { businessSettings, member, organization, user } from "@/db/schema";
import type { TenantScope } from "@/lib/data/scope";

/** Inserts a user + organization + owner membership + settings directly. */
export async function createTenant(
  label: string,
  { teamMode = "team" }: { teamMode?: "solo" | "team" } = {},
): Promise<TenantScope & { memberId: string }> {
  const suffix = randomUUID().slice(0, 8);
  const userId = `user-${suffix}`;
  const orgId = `org-${suffix}`;
  const slug = `${label}-${suffix}`;
  const memberId = `member-${suffix}`;

  await db.insert(user).values({
    id: userId,
    name: `Owner ${label}`,
    email: `${slug}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(organization).values({ id: orgId, name: label, slug, createdAt: new Date() });
  await db.insert(member).values({
    id: memberId,
    organizationId: orgId,
    userId,
    role: "owner",
    createdAt: new Date(),
  });
  const [settings] = await db
    .insert(businessSettings)
    .values({ organizationId: orgId, slug, appointmentsEnabled: true, membershipsEnabled: true, teamMode })
    .returning();

  return { organization: { id: orgId, name: label, slug }, settings, memberId };
}

/** Closes the shared pool once the test file finishes. */
export function closeDbAfterAll() {
  afterAll(async () => {
    await (db.$client as Pool).end();
  });
}
