import { z } from "zod";

export type FieldErrors = Record<string, string | undefined>;

/**
 * Parses a FormData object with a Zod schema; returns data or the first error
 * per field. Keys listed in `arrays` are read with getAll() (e.g. checkboxes).
 */
export function parseForm<T extends z.ZodType>(
  schema: T,
  formData: FormData,
  options: { arrays?: string[] } = {},
): { success: true; data: z.infer<T> } | { success: false; errors: FieldErrors } {
  const input: Record<string, unknown> = Object.fromEntries(formData);
  for (const key of options.arrays ?? []) input[key] = formData.getAll(key);

  const result = schema.safeParse(input);
  if (result.success) return { success: true, data: result.data };

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return { success: false, errors };
}

/** Only allow same-site relative redirects (prevents open redirects). */
export function safeRedirectPath(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
