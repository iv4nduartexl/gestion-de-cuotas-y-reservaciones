import { describe, expect, it } from "vitest";

import { exampleServices, sectionHelp } from "@/lib/help-content";
import { allNavItems, buildNavigation, mobileTabs, patchNavItem } from "@/lib/navigation";
import { pendingSetupSections, setupSteps, type SetupStatus } from "@/lib/setup-steps";

const gym = { businessType: "gimnasio", teamMode: "solo", appointmentsEnabled: false, membershipsEnabled: true } as const;
const barber = { businessType: "barberia", teamMode: "solo", appointmentsEnabled: true, membershipsEnabled: false } as const;
const both = { businessType: "academia", teamMode: "team", appointmentsEnabled: true, membershipsEnabled: true } as const;

const empty: SetupStatus = { clients: 0, services: 0, staff: 1, availabilityRules: 0, onlineAppointments: 0, plans: 0, enrollments: 0 };

describe("section help", () => {
  it("speaks the business's language", () => {
    expect(sectionHelp("clients", gym).title).toBe("Socios");
    expect(sectionHelp("clients", gym).what).toContain("pagos");
    expect(sectionHelp("clients", barber).what).not.toContain("pagos");
    expect(sectionHelp("services", both).title).toBe("Clases");
    expect(sectionHelp("reminders", gym).what).toContain("cuota");
    expect(sectionHelp("reminders", barber).what).toContain("turno");
  });

  it("has examples for every business type", () => {
    for (const type of ["barberia", "salon", "clinica", "estetica", "gimnasio", "academia", "otro"] as const) {
      expect(exampleServices(type)).toHaveLength(3);
    }
  });
});

describe("navigation", () => {
  it("splits daily work from setup and hides unused sections", () => {
    const nav = buildNavigation(gym);
    expect(nav.groups.map((g) => g.label)).toEqual(["Tu día", "Tu negocio"]);
    expect(nav.groups[0].items.map((i) => i.label)).toEqual(["Inicio", "Cuotas", "Recordatorios", "Socios"]);
    expect(nav.groups[1].items.map((i) => i.label)).toEqual(["Planes", "Configuración"]);
    expect(allNavItems(nav).every((item) => item.subtitle.length > 0)).toBe(true);

    const team = buildNavigation(both);
    expect(team.groups[1].items.map((i) => i.icon)).toEqual(["services", "schedule", "team", "plans", "settings"]);
  });

  it("phone tabs take the four most used sections", () => {
    expect(mobileTabs(buildNavigation(barber)).map((i) => i.icon)).toEqual(["home", "agenda", "clients", "reminders"]);
    expect(mobileTabs(buildNavigation(both)).map((i) => i.icon)).toEqual(["home", "agenda", "cuotas", "clients"]);
  });

  it("patches badges and setup dots", () => {
    const nav = patchNavItem(buildNavigation(barber), "reminders", { badge: 3 });
    expect(allNavItems(nav).find((i) => i.icon === "reminders")?.badge).toBe(3);
  });
});

describe("setup steps", () => {
  it("builds first, then uses, in the right order", () => {
    const steps = setupSteps(both, empty, "http://x/a");
    expect(steps.map((s) => s.id)).toEqual(["schedule", "services", "team", "plans", "clients", "enroll", "booking"]);
    expect(steps.filter((s) => s.milestone === "build").map((s) => s.id)).toEqual(["schedule", "services", "team", "plans"]);
    expect(steps.every((s) => s.unlocks.length > 0)).toBe(true);
    expect(setupSteps(gym, empty, "").map((s) => s.id)).toEqual(["plans", "clients", "enroll"]);
  });

  it("marks only unfinished setup sections", () => {
    expect(pendingSetupSections(both, empty)).toEqual(["schedule", "services", "team", "plans"]);
    expect(pendingSetupSections(both, { ...empty, availabilityRules: 5, services: 2, staff: 3, plans: 1 })).toEqual([]);
  });
});
