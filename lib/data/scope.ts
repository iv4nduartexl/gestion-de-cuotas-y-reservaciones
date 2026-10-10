import type { TenantContext } from "@/lib/tenant";

/**
 * What the data layer needs from the tenant context. Always obtained from
 * getTenantContext(); data functions never accept a bare organizationId.
 */
export type TenantScope = Pick<TenantContext, "organization" | "settings">;

/** Thrown when a referenced record doesn't exist in the current tenant. */
export class InvalidReferenceError extends Error {
  constructor(public field: string) {
    super(`Invalid reference: ${field}`);
    this.name = "InvalidReferenceError";
  }
}

/** Escapes LIKE wildcards in user input. */
export function likePattern(value: string) {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export const PAGE_SIZE = 20;
