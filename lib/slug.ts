import { z } from "zod";

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 48;

// Top-level paths the app uses (or will use). Public booking pages live at
// /[slug], so these can never be business slugs.
/** Lowercase language prefixes browsers or old links may add (/es, /es-py, /en…). */
export const LANGUAGE_PREFIXES = ["es", "es-py", "es-ar", "es-es", "en", "en-us", "pt", "pt-br"];

const RESERVED_SLUGS = new Set([
  "about",
  "admin",
  "api",
  "app",
  "auth",
  "dashboard",
  "email-verified",
  "forgot-password",
  "help",
  "login",
  "logout",
  "onboarding",
  "pricing",
  "privacy",
  "reset-password",
  "settings",
  "sign-in",
  "sign-out",
  "sign-up",
  "signin",
  "signup",
  "static",
  "support",
  "terms",
  "verify-email",
  "www",
  // Our own routes (current and planned).
  "baja",
  "cuenta",
  "invitacion",
  "media",
  "privacidad",
  "reportes",
  "terminos",
  // Language prefixes: they redirect to the page without the prefix
  // (next.config.ts), so a business can never use them as its link.
  ...LANGUAGE_PREFIXES,
]);

/** "Peluquería Doña Ana" -> "peluqueria-dona-ana" */
export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

export const slugSchema = z
  .string()
  .trim()
  .min(SLUG_MIN_LENGTH, `Usá al menos ${SLUG_MIN_LENGTH} caracteres.`)
  .max(SLUG_MAX_LENGTH, `Usá como máximo ${SLUG_MAX_LENGTH} caracteres.`)
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Solo letras minúsculas, números y guiones (sin guiones al inicio o al final).",
  )
  .refine((slug) => !RESERVED_SLUGS.has(slug), "Esta dirección está reservada.");
