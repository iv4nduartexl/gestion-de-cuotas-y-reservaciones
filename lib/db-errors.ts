// Postgres error helpers. Drizzle wraps driver errors, so check `cause` too.

function pgCode(error: unknown): string | undefined {
  const candidate = (error as { cause?: unknown })?.cause ?? error;
  return (candidate as { code?: string })?.code;
}

function pgConstraint(error: unknown): string | undefined {
  const candidate = (error as { cause?: unknown })?.cause ?? error;
  return (candidate as { constraint?: string })?.constraint;
}

export function isUniqueViolation(error: unknown, constraint?: string) {
  return (
    pgCode(error) === "23505" &&
    (!constraint || pgConstraint(error) === constraint)
  );
}

export function isForeignKeyViolation(error: unknown) {
  return pgCode(error) === "23503";
}

export function isExclusionViolation(error: unknown) {
  return pgCode(error) === "23P01";
}
