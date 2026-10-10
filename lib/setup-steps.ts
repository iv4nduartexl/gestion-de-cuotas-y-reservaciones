// The getting-started checklist, in two milestones: build the business, then
// start using it. Pure (no database): fed by getSetupStatus().

import { vocabularyFor, type BusinessType, type TeamMode } from "@/lib/business-types";
import type { Section } from "@/lib/help-content";

export type SetupStatus = {
  clients: number;
  services: number;
  staff: number;
  availabilityRules: number;
  onlineAppointments: number;
  plans: number;
  enrollments: number;
};

export type SetupSettings = {
  businessType: BusinessType;
  teamMode: TeamMode;
  appointmentsEnabled: boolean;
  membershipsEnabled: boolean;
};

export type StepPreview = "schedule" | "services" | "team" | "plans" | "clients" | "enroll" | "booking";

export type SetupStepDef = {
  id: StepPreview;
  milestone: "build" | "use";
  /** Sidebar section that shows a "falta configurar" dot while pending. */
  section: Section | null;
  title: string;
  why: string;
  /** What this step unlocks ("Después de esto…"). */
  unlocks: string;
  href: string;
  cta: string;
  done: boolean;
  /** Opens outside the dashboard (the public booking page). */
  external?: boolean;
};

export const MILESTONES = {
  build: { title: "Armá tu negocio", description: "Una sola vez: qué ofrecés, cuándo atendés y qué cobrás." },
  use: { title: "Empezá a usarlo", description: "Cargá a tus clientes y probá lo que ven ellos." },
} as const;

export function setupSteps(settings: SetupSettings, status: SetupStatus, bookingUrl: string): SetupStepDef[] {
  const words = vocabularyFor(settings.businessType);
  const steps: SetupStepDef[] = [];

  if (settings.appointmentsEnabled) {
    steps.push({
      id: "schedule",
      milestone: "build",
      section: "schedule",
      title: "Definí tu horario de atención",
      why: "Tus clientes solo van a poder reservar dentro de estos horarios. Si cortás al mediodía, agregás dos franjas. Toma un minuto.",
      unlocks: "Tu link de reservas ofrece solo horarios en los que atendés.",
      href: "/dashboard/schedule",
      cta: "Configurar horario",
      done: status.availabilityRules > 0,
    });
    steps.push({
      id: "services",
      milestone: "build",
      section: "services",
      title: `Cargá tus ${words.service.many}`,
      why: `Cada ${words.service.one} tiene una duración y un precio: así sabemos cuánto tiempo reservar y cuánto cobrar.`,
      unlocks: `Tus ${words.client.many} ya pueden elegir ${words.service.one} y reservar desde tu link.`,
      href: status.services > 0 ? "/dashboard/services" : "/dashboard/services/new",
      cta: `Agregar ${words.service.one}`,
      done: status.services > 0,
    });
    if (settings.teamMode === "team") {
      steps.push({
        id: "team",
        milestone: "build",
        section: "team",
        title: "Sumá a tu equipo",
        why: `Agregá a cada ${words.staff.one}: cada persona tiene su propio horario y elige qué ${words.service.many} realiza.`,
        unlocks: `Tus ${words.client.many} eligen con quién atenderse y cada uno ve sus turnos.`,
        href: "/dashboard/staff/new",
        cta: "Agregar persona",
        done: status.staff > 1,
      });
    }
  }
  if (settings.membershipsEnabled) {
    steps.push({
      id: "plans",
      milestone: "build",
      section: "plans",
      title: "Creá tus planes",
      why: "Un plan es lo que cobrás cada mes (o cada semana, o cada 3 meses). Por ejemplo “Musculación · Gs. 150.000 por mes”.",
      unlocks: `Inscribís a tus ${words.client.many} y Agenda arma sus cuotas solo.`,
      href: status.plans > 0 ? "/dashboard/planes" : "/dashboard/planes/new",
      cta: "Crear plan",
      done: status.plans > 0,
    });
  }

  steps.push({
    id: "clients",
    milestone: "use",
    section: null,
    title: `Cargá tus primeros ${words.client.many}`,
    why: `Guardá a las personas que te visitan con su teléfono y C.I. Si cargás su correo, los recordatorios le llegan solos.`,
    unlocks: "Les escribís por WhatsApp con un toque y les llegan recordatorios.",
    href: "/dashboard/clients/new",
    cta: `Agregar ${words.client.one}`,
    done: status.clients > 0,
  });
  if (settings.membershipsEnabled) {
    steps.push({
      id: "enroll",
      milestone: "use",
      section: null,
      title: `Inscribí a tus ${words.client.many} en un plan`,
      why: `Desde la ficha de cada ${words.client.one}, tocá “Inscribir en un plan”. Agenda arma sus cuotas solo y te avisa quién está vencido.`,
      unlocks: "Las cuotas aparecen en Cuotas y se recuerdan solas antes de vencer.",
      href: "/dashboard/clients",
      cta: `Ir a ${words.client.many}`,
      done: status.enrollments > 0,
    });
  }
  if (settings.appointmentsEnabled) {
    steps.push({
      id: "booking",
      milestone: "use",
      section: null,
      title: "Hacé una reserva de prueba",
      why: "Abrí tu link como si fueras un cliente y reservá un turno. Así ves exactamente lo que ven ellos (después lo podés cancelar).",
      unlocks: "Compartí tu link por WhatsApp o Instagram: los turnos llegan solos a tu Agenda.",
      href: bookingUrl,
      cta: "Abrir mi página de reservas",
      done: status.onlineAppointments > 0,
      external: true,
    });
  }
  return steps;
}

/** Setup sections that still need configuring (sidebar "falta configurar" dots). */
export function pendingSetupSections(settings: SetupSettings, status: SetupStatus): Section[] {
  return setupSteps(settings, status, "")
    .filter((step) => step.milestone === "build" && !step.done && step.section)
    .map((step) => step.section!);
}
