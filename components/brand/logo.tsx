import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/brand";

/**
 * Agenda's mark: a calendar with a check. `tone="light"` is for dark
 * surfaces (sidebar, brand panels).
 */
export function LogoMark({
  size = 32,
  tone = "brand",
  className,
}: {
  size?: number;
  tone?: "brand" | "light";
  className?: string;
}) {
  const tile = tone === "light" ? "#3B82F6" : "#1D4ED8";
  const check = tone === "light" ? "#FFFFFF" : "#F26B5B";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <rect width="56" height="56" rx="16" fill={tile} />
      <rect x="13" y="16" width="30" height="27" rx="6" fill="none" stroke="#FFFFFF" strokeWidth="3.5" />
      <line x1="13" y1="24" x2="43" y2="24" stroke="#FFFFFF" strokeWidth="3.5" />
      <line x1="21" y1="11" x2="21" y2="18" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="35" y1="11" x2="35" y2="18" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M21 33 l5 5 l9 -9" fill="none" stroke={check} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({
  size = 32,
  tone = "brand",
  className,
}: {
  size?: number;
  tone?: "brand" | "light";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} tone={tone} />
      <span
        className={cn(
          "font-extrabold tracking-tight",
          tone === "light" ? "text-white" : "text-foreground",
        )}
        style={{ fontSize: size * 0.62 }}
      >
        {APP_NAME}
      </span>
    </span>
  );
}
