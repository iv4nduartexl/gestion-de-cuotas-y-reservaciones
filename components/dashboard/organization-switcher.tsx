"use client";

import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { setActiveOrganizationAction } from "@/app/organization-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { initials } from "@/components/ui-kit/entity-avatar";

type OrganizationOption = { id: string; name: string; slug: string };

export function OrganizationSwitcher({
  organizations,
  activeOrganization,
  subtitle,
}: {
  organizations: OrganizationOption[];
  activeOrganization: OrganizationOption;
  subtitle: string;
}) {
  const { isMobile } = useSidebar();
  const [pending, startTransition] = useTransition();

  function switchTo(organizationId: string) {
    if (organizationId === activeOrganization.id) return;
    const formData = new FormData();
    formData.set("organizationId", organizationId);
    startTransition(() => setActiveOrganizationAction(formData));
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="h-14 rounded-2xl border border-sidebar-border bg-white/5 px-2.5 text-white hover:bg-white/10 hover:text-white data-popup-open:bg-white/10 data-popup-open:text-white"
                disabled={pending}
              />
            }
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-coral text-sm font-extrabold text-[#2a0a05]">
              {initials(activeOrganization.name)}
            </span>
            <span className="grid flex-1 text-left leading-tight">
              <span className="truncate text-sm font-bold">{activeOrganization.name}</span>
              <span className="truncate text-xs text-sidebar-muted">{subtitle}</span>
            </span>
            <ChevronsUpDownIcon className="ml-auto text-sidebar-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-60"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={8}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>Tus negocios</DropdownMenuLabel>
              {organizations.map((org) => (
                <DropdownMenuItem key={org.id} onClick={() => switchTo(org.id)}>
                  <span className="flex size-6 items-center justify-center rounded-md bg-primary-soft text-[10px] font-extrabold text-primary-soft-foreground">
                    {initials(org.name)}
                  </span>
                  <span className="flex-1 truncate">{org.name}</span>
                  {org.id === activeOrganization.id && <CheckIcon className="text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/onboarding" />}>
              <PlusIcon />
              Agregar negocio
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
