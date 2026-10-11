"use client";

import { LayoutGridIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { NavIcon } from "@/components/dashboard/nav-icon";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { allNavItems, isActiveItem, mobileTabs, type Navigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const tabClassName = "flex flex-col items-center gap-1 rounded-xl py-1.5 text-xs font-semibold";

function TabIcon({ active, badge, children }: { active: boolean; badge?: number; children: React.ReactNode }) {
  return (
    <span className={cn("relative flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-primary-soft")}>
      {children}
      {badge ? (
        <span className="absolute -top-1 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-white tabular">
          {badge}
        </span>
      ) : null}
    </span>
  );
}

/** Bottom navigation on phones: the four most used sections + "Más" with everything else. */
export function MobileTabBar({ navigation }: { navigation: Navigation }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const tabs = mobileTabs(navigation);
  const rest = allNavItems(navigation).filter((item) => !tabs.some((tab) => tab.href === item.href));
  const moreActive = rest.some((item) => isActiveItem(pathname, item));
  const moreBadge = rest.reduce((sum, item) => sum + (item.badge ?? 0), 0);

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card/95 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        {tabs.map((item) => {
          const active = isActiveItem(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(tabClassName, active ? "text-primary" : "text-muted-foreground")}
            >
              <TabIcon active={active} badge={item.badge}>
                <NavIcon name={item.icon} className="size-5" />
              </TabIcon>
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className={cn(tabClassName, moreActive ? "text-primary" : "text-muted-foreground")}
        >
          <TabIcon active={moreActive} badge={moreBadge}>
            <LayoutGridIcon className="size-5" aria-hidden="true" />
          </TabIcon>
          Más
        </button>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-3xl px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted" aria-hidden="true" />
          <SheetHeader className="px-1 pb-2">
            <SheetTitle className="text-lg font-bold">Todas las secciones</SheetTitle>
            <SheetDescription>Lo de todos los días, y “Mi negocio” para configurar.</SheetDescription>
          </SheetHeader>
          {navigation.groups.map((group) => (
            <section key={group.id} className={cn("flex flex-col gap-1 py-2", group.id === "business" && "border-t")}>
              {group.label && <h2 className="px-1 text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">{group.label}</h2>}
              <ul className="grid grid-cols-1 gap-1">
                {group.items.map((item) => {
                  const active = isActiveItem(pathname, item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        aria-describedby={`more-${item.icon}`}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl px-3 py-2.5",
                          active ? "bg-primary-soft text-primary-soft-foreground" : "hover:bg-muted",
                        )}
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/80">
                          <NavIcon name={item.icon} className="size-5" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="flex items-center gap-1.5 font-semibold">
                            {item.label}
                            {item.todo && <span className="size-2 rounded-full bg-coral" title="Falta configurar" />}
                          </span>
                          <span id={`more-${item.icon}`} aria-hidden="true" className="truncate text-sm text-muted-foreground">
                            {item.todo ? "Hay algo para revisar · " : ""}
                            {item.subtitle}
                          </span>
                        </span>
                        {item.badge ? (
                          <span className="rounded-full bg-coral px-2 text-xs font-bold text-white tabular">
                            {item.badge}
                            <span className="sr-only"> pendientes</span>
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </SheetContent>
      </Sheet>
    </>
  );
}
