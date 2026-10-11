import { z } from "zod";

// Server-side environment. Validated once on import; `instrumentation.ts`
// imports this module so a bad configuration fails at startup.
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.url(),
    // Max connections per app instance (keep below Postgres max_connections).
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
    BETTER_AUTH_URL: z.url(),
    EMAIL_TRANSPORT: z.enum(["console", "smtp"]).default("console"),
    EMAIL_FROM: z.string().min(1).default("no-reply@localhost"),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    // "true" for implicit TLS (usually port 465); STARTTLS otherwise.
    SMTP_SECURE: z.enum(["true", "false"]).default("false"),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    // Rate limits for sign-in (Better Auth, production only) and public
    // bookings. Only the e2e test server turns them off, since every test
    // comes from 127.0.0.1.
    RATE_LIMITS: z.enum(["on", "off"]).default("on"),
    // Shared secret for scheduled jobs (/api/cron/*). Unset = endpoints disabled.
    CRON_SECRET: z.string().min(32).optional(),
    // Enabled payment providers (comma separated). "manual" is always available.
    PAYMENT_PROVIDERS: z.string().default("manual"),
    // Test/dev-only provider used to exercise the webhook flow.
    FAKE_PROVIDER_SECRET: z.string().min(16).optional(),
    // Set by the production Docker image. The e2e server also runs a
    // production build, so the strict checks below key off this flag
    // instead of NODE_ENV.
    DEPLOYMENT: z.enum(["local", "production"]).default("local"),
    // Developer accounts that can open /admin and enter any business as its
    // owner (comma separated). Only verified emails count. Empty = no admin.
    ADMIN_EMAILS: z
      .string()
      .default("")
      .transform((value) => value.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean))
      .pipe(z.array(z.email("ADMIN_EMAILS must be a comma-separated list of emails"))),
  })
  .superRefine((env, ctx) => {
    if (env.EMAIL_TRANSPORT === "smtp") {
      for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required when EMAIL_TRANSPORT=smtp` });
      }
    }
    if (env.DEPLOYMENT === "production") {
      if (env.EMAIL_TRANSPORT === "console") {
        ctx.addIssue({ code: "custom", path: ["EMAIL_TRANSPORT"], message: "Production needs a real email transport (smtp)" });
      }
      if (env.RATE_LIMITS === "off") {
        ctx.addIssue({ code: "custom", path: ["RATE_LIMITS"], message: "Rate limits can't be off in production" });
      }
      if (env.FAKE_PROVIDER_SECRET || env.PAYMENT_PROVIDERS.split(",").map((p) => p.trim()).includes("fake")) {
        ctx.addIssue({ code: "custom", path: ["PAYMENT_PROVIDERS"], message: "The fake payment provider is for tests only" });
      }
      if (!env.CRON_SECRET) {
        ctx.addIssue({ code: "custom", path: ["CRON_SECRET"], message: "Production needs CRON_SECRET: without it, cuotas and reminders never run" });
      }
      if (!env.BETTER_AUTH_URL.startsWith("https://")) {
        ctx.addIssue({ code: "custom", path: ["BETTER_AUTH_URL"], message: "Production must be served over https" });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables:\n" + z.prettifyError(parsed.error),
  );
  throw new Error("Invalid environment variables. See .env.example.");
}

export const env = parsed.data;
