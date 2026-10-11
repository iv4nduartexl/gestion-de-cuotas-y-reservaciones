"use client";

import { ChevronsUpDownIcon, CircleHelpIcon, LogOutIcon, ShieldIcon } from "lucide-react";
import { useRouter } from "next/navigation";

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
import { authClient } from "@/lib/auth/client";

export function NavUser({
  user,
  roleLabel,
  showAdmin = false,
}: {
  user: { name: string; email: string };
  roleLabel: string;
  /** The developer admin (ADMIN_EMAILS) gets a link to /admin. */
  showAdmin?: boolean;
}) {
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();

  async function signOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="h-14 rounded-2xl px-2.5 text-white hover:bg-white/10 hover:text-white data-popup-open:bg-white/10 data-popup-open:text-white"
              />
            }
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-extrabold text-sidebar-accent-foreground">
              {initials(user.name)}
            </span>
            <span className="grid flex-1 text-left leading-tight">
              <span className="truncate text-sm font-bold">{user.name}</span>
              <span className="truncate text-xs text-sidebar-muted">{user.email}</span>
            </span>
            <ChevronsUpDownIcon className="ml-auto text-sidebar-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-60"
            side={isMobile ? "top" : "right"}
            align="end"
            sideOffset={8}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col gap-0.5 py-2 text-foreground">
                <span className="text-sm font-bold">{user.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {user.email} · {roleLabel}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setOpenMobile(false);
                router.push("/dashboard?bienvenida=1");
              }}
            >
              <CircleHelpIcon />
              ¿Qué hace Agenda?
            </DropdownMenuItem>
            {showAdmin && (
              <DropdownMenuItem
                onClick={() => {
                  setOpenMobile(false);
                  router.push("/admin");
                }}
              >
                <ShieldIcon />
                Panel de admin
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={signOut}>
              <LogOutIcon />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
