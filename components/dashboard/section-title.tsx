"use client";

import { usePathname } from "next/navigation";

import { isActivePath, type NavItem } from "@/lib/navigation";

/** Name of the current section in the top bar. */
export function SectionTitle({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const current = [...items].reverse().find((item) => isActivePath(pathname, item.href));
  return <span className="truncate text-sm font-bold">{current?.label ?? "Panel"}</span>;
}
