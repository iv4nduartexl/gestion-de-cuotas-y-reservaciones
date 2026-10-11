import { describe, expect, it } from "vitest";

import { isAdminIdentity } from "@/lib/admin-access";
import { envSchema } from "@/lib/env";

const base = {
  DATABASE_URL: "postgres://u:p@db:5432/agenda",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
};

describe("ADMIN_EMAILS", () => {
  it("is a trimmed, lowercase list; empty means no admin", () => {
    expect(envSchema.parse({ ...base }).ADMIN_EMAILS).toEqual([]);
    expect(envSchema.parse({ ...base, ADMIN_EMAILS: " Dev@Example.com , ops@example.com ," }).ADMIN_EMAILS).toEqual([
      "dev@example.com",
      "ops@example.com",
    ]);
  });

  it("refuses something that isn't an email", () => {
    expect(envSchema.safeParse({ ...base, ADMIN_EMAILS: "dev@example.com, nope" }).success).toBe(false);
  });
});

describe("isAdminIdentity", () => {
  const list = ["dev@example.com"];
  const dev = { email: "Dev@example.com", emailVerified: true };

  it("accepts a verified, listed email acting as themselves", () => {
    expect(isAdminIdentity(dev, { impersonatedBy: null }, list)).toBe(true);
  });

  it("rejects unverified, unlisted, or while impersonating", () => {
    expect(isAdminIdentity({ ...dev, emailVerified: false }, {}, list)).toBe(false);
    expect(isAdminIdentity({ email: "owner@example.com", emailVerified: true }, {}, list)).toBe(false);
    expect(isAdminIdentity(dev, { impersonatedBy: "someone" }, list)).toBe(false);
    expect(isAdminIdentity(dev, {}, [])).toBe(false);
  });
});
