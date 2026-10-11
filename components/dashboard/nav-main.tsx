"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavIcon } from "@/components/dashboard/nav-icon";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { isActiveItem, type NavGroup } from "@/lib/navigation";

export const sidebarItemClassName =
  "group/nav h-auto min-h-11 rounded-xl px-3 py-2 text-[15px] font-semibold text-sidebar-foreground hover:bg-white/10 hover:text-white active:bg-white/15 active:text-white data-active:bg-sidebar-accent data-active:font-bold data-active:text-sidebar-accent-foreground data-active:hover:bg-sidebar-accent data-active:hover:text-sidebar-accent-foreground [&_svg]:size-5";

/** Sidebar sections in two groups: daily work ("Tu día") and setup ("Tu negocio"). */
export function NavMain({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return groups.map((group, index) => (
    <SidebarGroup key={group.id} className={index > 0 ? "border-t border-sidebar-border pt-3" : "py-1"}>
      {group.label && (
        <SidebarGroupLabel className="px-3 text-[11px] font-bold tracking-[0.12em] text-sidebar-muted uppercase">{group.label}</SidebarGroupLabel>
      )}
      <SidebarMenu className="gap-0.5">
        {group.items.map((item) => {
          const descriptionId = `nav-${item.icon}-description`;
          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                isActive={isActiveItem(pathname, item)}
                tooltip={item.label}
                className={sidebarItemClassName}
                aria-describedby={descriptionId}
                render={<Link href={item.href} onClick={() => setOpenMobile(false)} />}
              >
                <NavIcon name={item.icon} />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="flex items-center gap-1.5">
                    {item.label}
                    {item.todo && (
                      <span className="size-2 rounded-full bg-coral" title="Hay algo para revisar">
                        <span className="sr-only"> (tiene algo para revisar)</span>
                      </span>
                    )}
                  </span>
                  {/* Hidden from the link's name (it stays "Agenda"), read as its description. */}
                  <span
                    id={descriptionId}
                    aria-hidden="true"
                    className="truncate text-xs font-medium text-sidebar-muted group-data-active/nav:text-sidebar-accent-foreground/70"
                  >
                    {item.subtitle}
                  </span>
                </span>
              </SidebarMenuButton>
              {item.badge ? (
                <SidebarMenuBadge className="top-1/2! right-2 -translate-y-1/2 rounded-full bg-coral px-1.5 text-xs font-bold text-white tabular peer-hover/menu-button:text-white peer-data-active/menu-button:text-white">
                  {item.badge}
                  <span className="sr-only"> pendientes</span>
                </SidebarMenuBadge>
              ) : null}
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  ));
}
