import { capitalize, vocabularyFor, type BusinessType, type TeamMode } from "@/lib/business-types";

export type NavIcon = "home" | "clients" | "services" | "schedule" | "team" | "settings";
export type NavItem = { href: string; label: string; icon: NavIcon };

/**
 * The dashboard sections this business actually uses, in its own words
 * ("Pacientes", "Socios"...). Shared by the sidebar, the mobile tab bar and
 * the header.
 */
export function buildNavigation(settings: {
  businessType: BusinessType;
  teamMode: TeamMode;
  appointmentsEnabled: boolean;
}): { main: NavItem[]; settings: NavItem } {
  const words = vocabularyFor(settings.businessType);
  const main: NavItem[] = [
    { href: "/dashboard", label: "Inicio", icon: "home" },
    { href: "/dashboard/clients", label: capitalize(words.client.many), icon: "clients" },
  ];
  if (settings.appointmentsEnabled) {
    main.push(
      { href: "/dashboard/services", label: capitalize(words.service.many), icon: "services" },
      { href: "/dashboard/schedule", label: "Horarios", icon: "schedule" },
    );
    if (settings.teamMode === "team") {
      main.push({ href: "/dashboard/staff", label: "Equipo", icon: "team" });
    }
  }
  return {
    main,
    settings: { href: "/dashboard/settings", label: "Configuración", icon: "settings" },
  };
}

export function isActivePath(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
