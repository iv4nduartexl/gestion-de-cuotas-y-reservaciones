import { cn } from "@/lib/utils";

/**
 * Input with a fixed prefix (e.g. "Gs." or "PY"). Put a borderless input
 * inside; the group draws the border and focus ring.
 */
export function InputGroup({
  prefix,
  invalid,
  children,
  className,
}: {
  prefix: React.ReactNode;
  invalid?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-invalid={invalid ? "" : undefined}
      className={cn(
        "flex h-10 w-full items-stretch overflow-hidden rounded-xl border border-input bg-card transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 data-invalid:border-destructive data-invalid:ring-3 data-invalid:ring-destructive/20",
        className,
      )}
    >
      <span className="flex items-center border-r border-input bg-muted px-3 text-sm font-semibold text-muted-foreground select-none">
        {prefix}
      </span>
      {children}
    </div>
  );
}

export const groupedInputClassName =
  "h-full w-full min-w-0 border-0 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground md:text-sm";
