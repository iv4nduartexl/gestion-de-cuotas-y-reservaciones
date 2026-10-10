"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavIcon } from "@/components/dashboard/nav-icon";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { isActivePath, type NavItem } from "@/lib/navigation";

export const sidebarItemClassName =
  "h-11 rounded-xl px-3 text-[15px] font-semibold text-sidebar-foreground hover:bg-white/10 hover:text-white active:bg-white/15 active:text-white data-active:bg-sidebar-accent data-active:font-bold data-active:text-sidebar-accent-foreground data-active:hover:bg-sidebar-accent data-active:hover:text-sidebar-accent-foreground [&_svg]:size-5";

export function NavMain({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarGroup>
      <SidebarMenu className="gap-1">
        {items.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              isActive={isActivePath(pathname, item.href)}
              tooltip={item.label}
              className={sidebarItemClassName}
              render={<Link href={item.href} onClick={() => setOpenMobile(false)} />}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
