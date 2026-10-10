import { z } from "zod";

/** Optional text input: trims, and turns "" / missing into null. */
export function optionalText(max: number, message = `Usá como máximo ${max} caracteres.`) {
  return z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : ""),
    z.string().max(max, message).transform((value) => value || null),
  );
}

export function requiredText(min: number, max: number, requiredMessage: string) {
  return z
    .string({ error: requiredMessage })
    .trim()
    .min(min, requiredMessage)
    .max(max, `Usá como máximo ${max} caracteres.`);
}

export const idSchema = z.uuid("Identificador inválido.");

/** Checkbox values arrive as "on"/"true" when checked and are missing otherwise. */
export const checkbox = z.preprocess(
  (value) => value === "on" || value === "true",
  z.boolean(),
);
