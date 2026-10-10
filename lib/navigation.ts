import type { BusinessType, TeamMode } from "@/lib/business-types";
import { SECTION_HREFS, sectionHelp, type Section } from "@/lib/help-content";

export type NavIcon = Section;

/**
 * `subtitle`: a few words saying what the section is for.
 * `badge`: a count shown next to the label (e.g. reminders to send today).
 * `todo`: setup section that isn't configured yet.
 */
export type NavItem = { href: string; label: string; icon: NavIcon; subtitle: string; badge?: number; todo?: boolean };
export type NavGroup = { id: "day" | "business"; label: string; items: NavItem[] };
export type Navigation = { groups: NavGroup[] };

type NavSettings = {
  businessType: BusinessType;
  teamMode: TeamMode;
  appointmentsEnabled: boolean;
  membershipsEnabled: boolean;
};

/**
 * The dashboard sections this business actually uses, in its own words
 * ("Pacientes", "Socios"...), split into daily work ("Tu día") and one-time
 * setup ("Tu negocio"). Shared by the sidebar, the phone tab bar, the "Más"
 * sheet and the header.
 */
export function buildNavigation(settings: NavSettings): Navigation {
  const item = (section: Section): NavItem => {
    const help = sectionHelp(section, settings);
    return { href: SECTION_HREFS[section], label: help.title, icon: section, subtitle: help.subtitle };
  };

  const day: Section[] = ["home"];
  if (settings.appointmentsEnabled) day.push("agenda");
  if (settings.membershipsEnabled) day.push("cuotas");
  day.push("reminders", "clients");

  const business: Section[] = [];
  if (settings.appointmentsEnabled) {
    business.push("services", "schedule");
    if (settings.teamMode === "team") business.push("team");
  }
  if (settings.membershipsEnabled) business.push("plans");
  business.push("settings");

  return {
    groups: [
      { id: "day", label: "Tu día", items: day.map(item) },
      { id: "business", label: "Tu negocio", items: business.map(item) },
    ],
  };
}

export function allNavItems(navigation: Navigation) {
  return navigation.groups.flatMap((group) => group.items);
}

/** Returns a new navigation with `patch` applied to the item with that icon. */
export function patchNavItem(navigation: Navigation, icon: NavIcon, patch: Partial<Pick<NavItem, "badge" | "todo">>): Navigation {
  return {
    groups: navigation.groups.map((group) => ({
      ...group,
      items: group.items.map((item) => (item.icon === icon ? { ...item, ...patch } : item)),
    })),
  };
}

export function isActivePath(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** The phone tab bar: the four sections used most, in this order ("Más" holds the rest). */
export function mobileTabs(navigation: Navigation): NavItem[] {
  const priority: NavIcon[] = ["home", "agenda", "cuotas", "clients", "reminders"];
  const items = allNavItems(navigation);
  return priority
    .map((icon) => items.find((item) => item.icon === icon))
    .filter((item): item is NavItem => item !== undefined)
    .slice(0, 4);
}
