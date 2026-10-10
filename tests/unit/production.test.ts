import { describe, expect, it, vi } from "vitest";

import { clientIpFrom } from "@/lib/client-ip";
import { envSchema } from "@/lib/env";

const sendMail = vi.fn().mockResolvedValue({});
const createTransport = vi.fn(() => ({ sendMail }));
vi.mock("nodemailer", () => ({ default: { createTransport } }));

const base = {
  DATABASE_URL: "postgres://u:p@db:5432/agenda",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "https://agenda.example.com",
};
const smtp = { EMAIL_TRANSPORT: "smtp", SMTP_HOST: "smtp.example.com", SMTP_USER: "u", SMTP_PASSWORD: "p", CRON_SECRET: "c".repeat(32) };

function problems(input: Record<string, string>) {
  const result = envSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
}

describe("environment validation", () => {
  it("accepts a complete production configuration", () => {
    expect(problems({ ...base, ...smtp, DEPLOYMENT: "production" })).toEqual([]);
  });

  it("requires the SMTP settings when using SMTP", () => {
    expect(problems({ ...base, EMAIL_TRANSPORT: "smtp" })).toEqual(["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"]);
  });

  it("refuses unsafe settings in production", () => {
    expect(problems({ ...base, DEPLOYMENT: "production" })).toContain("EMAIL_TRANSPORT");
    expect(problems({ ...base, ...smtp, DEPLOYMENT: "production", RATE_LIMITS: "off" })).toEqual(["RATE_LIMITS"]);
    expect(problems({ ...base, ...smtp, DEPLOYMENT: "production", PAYMENT_PROVIDERS: "manual,fake" })).toEqual(["PAYMENT_PROVIDERS"]);
    expect(problems({ ...base, ...smtp, DEPLOYMENT: "production", BETTER_AUTH_URL: "http://agenda.example.com" })).toEqual(["BETTER_AUTH_URL"]);
    expect(problems({ ...base, ...smtp, DEPLOYMENT: "production", CRON_SECRET: "" })).toContain("CRON_SECRET");
  });

  it("keeps local and test setups permissive", () => {
    expect(problems({ ...base, RATE_LIMITS: "off", BETTER_AUTH_URL: "http://localhost:3100" })).toEqual([]);
  });
});

describe("client IP behind the proxy", () => {
  it("trusts X-Real-IP set by Caddy", () => {
    expect(clientIpFrom(new Headers({ "x-real-ip": "181.1.2.3", "x-forwarded-for": "6.6.6.6" }))).toBe("181.1.2.3");
  });

  it("ignores client-supplied X-Forwarded-For entries, keeping the closest hop", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "6.6.6.6, 181.1.2.3" }))).toBe("181.1.2.3");
    expect(clientIpFrom(new Headers())).toBe("unknown");
  });
});

describe("SMTP transport", () => {
  it("sends through a pooled STARTTLS connection", async () => {
    const { createSmtpTransport } = await import("@/lib/email/smtp-transport");
    const transport = createSmtpTransport({ host: "smtp.example.com", port: 587, secure: false, user: "u", password: "p", requireTls: true });
    await transport.send({ from: "Agenda <a@b.c>", to: "x@y.z", subject: "Hola", text: "t", html: "<p>t</p>" });
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: "smtp.example.com", port: 587, secure: false, requireTLS: true, pool: true }));
    expect(sendMail).toHaveBeenCalledWith({ from: "Agenda <a@b.c>", to: "x@y.z", subject: "Hola", text: "t", html: "<p>t</p>" });
  });
});
