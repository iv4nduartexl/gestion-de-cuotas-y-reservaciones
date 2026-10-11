import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { session, user } from "@/db/schema";
import { ensureAdminRole, findOwner, listBusinesses, setSessionBusiness } from "@/lib/admin";
import type { Session } from "@/lib/auth";
import { createClient } from "@/lib/data/clients";
import { closeDbAfterAll, createTenant } from "./fixtures";

closeDbAfterAll();

type Tenant = Awaited<ReturnType<typeof createTenant>>;
let a: Tenant;
let b: Tenant;

beforeAll(async () => {
  a = await createTenant("admin-alfa");
  b = await createTenant("admin-beta");
  await createClient(a, { name: "Uno", phone: "+595981000901", email: null, documentNumber: null, notes: null });
  await createClient(a, { name: "Dos", phone: "+595981000902", email: null, documentNumber: null, notes: null });
});

describe("admin console data", () => {
  it("lists every business with its owner and counts, and searches by owner email", async () => {
    const { rows } = await listBusinesses({ q: "admin-" });
    const alfa = rows.find((row) => row.id === a.organization.id);
    expect(alfa).toMatchObject({ name: "admin-alfa", clients: 2, upcoming: 0, activeMemberships: 0, ownerName: "Owner admin-alfa" });
    expect(rows.some((row) => row.id === b.organization.id)).toBe(true);

    const byEmail = await listBusinesses({ q: b.organization.slug + "@example.com" });
    expect(byEmail.rows.map((row) => row.id)).toEqual([b.organization.id]);
  });

  it("finds the owner", async () => {
    expect((await findOwner(a.organization.id))?.name).toBe("Owner admin-alfa");
    expect(await findOwner("org-missing")).toBeNull();
  });

  it("a role set in the database is reset when the email isn't in ADMIN_EMAILS", async () => {
    const owner = (await findOwner(b.organization.id))!;
    await db.update(user).set({ role: "admin" }).where(eq(user.id, owner.id));
    const [row] = await db.select().from(user).where(eq(user.id, owner.id));
    const current = { user: { ...row, emailVerified: true }, session: { impersonatedBy: null } } as unknown as Session;
    expect(await ensureAdminRole(current)).toBe(false);
    const [after] = await db.select({ role: user.role }).from(user).where(eq(user.id, owner.id));
    expect(after.role).toBe("user");
  });

  it("points a session at the chosen business", async () => {
    const owner = (await findOwner(a.organization.id))!;
    const token = `token-${a.organization.id}`;
    await db.insert(session).values({
      id: `s-${a.organization.id}`,
      token,
      userId: owner.id,
      expiresAt: new Date(Date.now() + 3600_000),
      createdAt: new Date(),
      updatedAt: new Date(),
      impersonatedBy: "admin-user",
    });
    await setSessionBusiness(token, a.organization.id);
    const [row] = await db.select().from(session).where(eq(session.token, token));
    expect(row.activeOrganizationId).toBe(a.organization.id);
  });
});
