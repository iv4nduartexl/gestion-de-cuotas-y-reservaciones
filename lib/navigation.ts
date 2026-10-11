import type { BusinessType, TeamMode } from "@/lib/business-types";
import { SECTION_HREFS, sectionHelp, type Section } from "@/lib/help-content";

export type NavIcon = Section;

/**
 * `subtitle`: a few words saying what the section is for.
 * `badge`: a count shown next to the label (e.g. reminders to send today).
 * `todo`: setup section that isn't configured yet.
 */
export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  subtitle: string;
  badge?: number;
  todo?: boolean;
  /** Other paths that count as being in this section ("Mi negocio" → horarios, servicios…). */
  alsoActiveFor?: string[];
};
export type NavGroup = { id: "day" | "business"; label: string; items: NavItem[] };
export type Navigation = { groups: NavGroup[] };

type NavSettings = {
  businessType: BusinessType;
  teamMode: TeamMode;
  appointmentsEnabled: boolean;
  membershipsEnabled: boolean;
};

/** Setup sections of this business, in order (they live inside "Mi negocio"). */
export function setupSections(settings: NavSettings): Section[] {
  const sections: Section[] = [];
  if (settings.appointmentsEnabled) {
    sections.push("schedule", "services");
    if (settings.teamMode === "team") sections.push("team");
  }
  if (settings.membershipsEnabled) sections.push("plans");
  sections.push("settings");
  return sections;
}

function navItem(section: Section, settings: NavSettings): NavItem {
  const help = sectionHelp(section, settings);
  return { href: SECTION_HREFS[section], label: help.title, icon: section, subtitle: help.subtitle };
}

/**
 * The sidebar: only daily work, plus one "Mi negocio" entry that holds every
 * setup section (horarios, servicios, planes, equipo, configuración), so the
 * owner isn't faced with a long list of terms. Shared by the sidebar, the
 * phone tab bar and the "Más" sheet.
 */
export function buildNavigation(settings: NavSettings): Navigation {
  const day: Section[] = ["home"];
  if (settings.appointmentsEnabled) day.push("agenda");
  if (settings.membershipsEnabled) day.push("cuotas");
  day.push("reminders", "clients");
  return {
    groups: [
      { id: "day", label: "", items: day.map((section) => navItem(section, settings)) },
      {
        id: "business",
        label: "",
        items: [{ ...navItem("business", settings), alsoActiveFor: setupSections(settings).map((section) => SECTION_HREFS[section]) }],
      },
    ],
  };
}

/** Every page with a name (sidebar items + setup sections), for the header title. */
export function headerItems(settings: NavSettings): NavItem[] {
  return [...allNavItems(buildNavigation(settings)), ...setupSections(settings).map((section) => navItem(section, settings))];
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

/** Whether the user is in this item's section (including its sub-pages). */
export function isActiveItem(pathname: string, item: Pick<NavItem, "href" | "alsoActiveFor">) {
  return [item.href, ...(item.alsoActiveFor ?? [])].some((href) => isActivePath(pathname, href));
}

export function isActivePath(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** The phone tab bar: the four sections used most, in this order ("Más" holds the rest). */
export function mobileTabs(navigation: Navigation): NavItem[] {
  const priority: NavIcon[] = ["home", "agenda", "cuotas", "clients", "reminders"];
  // "Mi negocio" always lives in "Más".
  const items = allNavItems(navigation);
  return priority
    .map((icon) => items.find((item) => item.icon === icon))
    .filter((item): item is NavItem => item !== undefined)
    .slice(0, 4);
}
