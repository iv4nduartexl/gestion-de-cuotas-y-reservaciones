import { z } from "zod";

// Server-side environment. Validated once on import; `instrumentation.ts`
// imports this module so a bad configuration fails at startup.
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.url(),
  EMAIL_TRANSPORT: z.enum(["console"]).default("console"),
  // Better Auth rate limiting (active in production). Only the e2e test
  // server turns it off, since every test signs in from 127.0.0.1.
  AUTH_RATE_LIMIT: z.enum(["on", "off"]).default("on"),
  EMAIL_FROM: z.string().min(1).default("no-reply@localhost"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables:\n" + z.prettifyError(parsed.error),
  );
  throw new Error("Invalid environment variables. See .env.example.");
}

export const env = parsed.data;
