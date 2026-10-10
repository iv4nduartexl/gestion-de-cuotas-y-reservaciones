import { cn } from "@/lib/utils";

const TONES = [
  "bg-primary-soft text-primary-soft-foreground",
  "bg-coral-soft text-coral-foreground",
  "bg-success-soft text-success-foreground",
  "bg-warning-soft text-warning-foreground",
  "bg-[#ede9fe] text-[#5b21b6]",
  "bg-[#e0f2fe] text-[#075985]",
];

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/** Stable color per name, so the same client always looks the same. */
function toneFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}

export function EntityAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-extrabold",
        size === "sm" && "size-8 text-xs",
        size === "md" && "size-11 text-sm",
        size === "lg" && "size-16 text-xl",
        toneFor(name),
        className,
      )}
    >
      {initials(name) || "?"}
    </span>
  );
}
