import Link from "next/link";

import { NavMain } from "@/components/dashboard/nav-main";
import { NavUser } from "@/components/dashboard/nav-user";
import { OrganizationSwitcher } from "@/components/dashboard/organization-switcher";
import { Logo } from "@/components/brand/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { roleLabels } from "@/lib/auth/permissions";
import { BUSINESS_TYPE_INFO } from "@/lib/business-types";
import { getNavigation } from "@/lib/data/navigation";
import { getTenantContextOrRedirect, listUserOrganizations } from "@/lib/tenant";

export async function AppSidebar() {
  const ctx = await getTenantContextOrRedirect();
  const [organizations, navigation] = await Promise.all([listUserOrganizations(ctx.user.id), getNavigation(ctx)]);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="gap-4 px-3 pt-5">
        <Link href="/dashboard" className="px-2" aria-label="Agenda, inicio">
          <Logo size={30} tone="light" />
        </Link>
        <OrganizationSwitcher
          organizations={organizations}
          activeOrganization={ctx.organization}
          subtitle={BUSINESS_TYPE_INFO[ctx.settings.businessType].label}
        />
      </SidebarHeader>
      <SidebarContent className="px-1">
        <NavMain groups={navigation.groups} />
      </SidebarContent>
      <SidebarFooter className="gap-2 px-3 pb-4">
        <div className="border-t border-sidebar-border pt-2">
          <NavUser user={ctx.user} roleLabel={roleLabels[ctx.role]} />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export function AppSidebarSkeleton() {
  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="gap-4 px-3 pt-5">
        <div className="px-2">
          <Logo size={30} tone="light" />
        </div>
        <Skeleton className="h-14 w-full rounded-2xl bg-white/10" />
      </SidebarHeader>
      {/* Plain skeletons: SidebarMenuSkeleton uses Math.random(), which
          Cache Components rejects in the static shell. */}
      <SidebarContent className="gap-2 p-3">
        <Skeleton className="h-11 w-full rounded-xl bg-white/10" />
        <Skeleton className="h-11 w-full rounded-xl bg-white/10" />
        <Skeleton className="h-11 w-full rounded-xl bg-white/10" />
      </SidebarContent>
    </Sidebar>
  );
}
