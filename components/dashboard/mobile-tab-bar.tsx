"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavIcon } from "@/components/dashboard/nav-icon";
import { isActivePath, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Bottom navigation on phones: the four most used sections. */
export function MobileTabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-card/95 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl py-1.5 text-xs font-semibold",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                active && "bg-primary-soft",
              )}
            >
              <NavIcon name={item.icon} className="size-5" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
