// What every section is for, in the business's own words. Single source of
// truth for the sidebar subtitles, page "¿Para qué sirve?" panels, the welcome
// tour and the setup guide. No dependencies: used by server and client code.

import { capitalize, vocabularyFor, type BusinessType } from "@/lib/business-types";

export type Section =
  | "home"
  | "agenda"
  | "cuotas"
  | "reminders"
  | "clients"
  | "services"
  | "schedule"
  | "team"
  | "plans"
  | "settings";

export type HelpSettings = {
  businessType: BusinessType;
  appointmentsEnabled: boolean;
  membershipsEnabled: boolean;
};

export type SectionHelp = {
  /** Sidebar label. */
  title: string;
  /** Sidebar subtitle: a few words. */
  subtitle: string;
  /** One sentence: what you find/do here. */
  what: string;
  /** One sentence: what you gain. */
  why: string;
  /** Sections this one feeds into (shown as "Se conecta con"). */
  connectsTo: Section[];
  /** A concrete example in the business's vocabulary. */
  example?: string;
  /** Deep links for some connections (e.g. a Configuración tab). */
  connectionHrefs?: Partial<Record<Section, string>>;
};

export const SECTION_HREFS: Record<Section, string> = {
  home: "/dashboard",
  agenda: "/dashboard/agenda",
  cuotas: "/dashboard/cuotas",
  reminders: "/dashboard/recordatorios",
  clients: "/dashboard/clients",
  services: "/dashboard/services",
  schedule: "/dashboard/schedule",
  team: "/dashboard/staff",
  plans: "/dashboard/planes",
  settings: "/dashboard/settings",
};

const EXAMPLE_SERVICES: Record<BusinessType, [string, string][]> = {
  barberia: [["Corte clásico", "30 min · Gs. 50.000"], ["Corte y barba", "45 min · Gs. 70.000"], ["Perfilado de barba", "20 min · Gs. 30.000"]],
  salon: [["Color y brushing", "90 min · Gs. 180.000"], ["Corte de dama", "45 min · Gs. 90.000"], ["Manicura", "40 min · Gs. 60.000"]],
  clinica: [["Consulta general", "30 min · Gs. 150.000"], ["Control", "20 min · Gs. 100.000"], ["Primera consulta", "45 min · Gs. 200.000"]],
  estetica: [["Limpieza facial", "60 min · Gs. 200.000"], ["Masaje descontracturante", "50 min · Gs. 180.000"], ["Depilación", "30 min · Gs. 90.000"]],
  gimnasio: [["Clase de spinning", "45 min · Gs. 30.000"], ["Entrenamiento personal", "60 min · Gs. 100.000"], ["Evaluación física", "30 min · Gs. 50.000"]],
  academia: [["Clase de guitarra", "60 min · Gs. 80.000"], ["Clase de inglés", "60 min · Gs. 70.000"], ["Clase de prueba", "30 min · Gs. 0"]],
  otro: [["Sesión", "60 min · Gs. 100.000"], ["Sesión corta", "30 min · Gs. 60.000"], ["Primera visita", "45 min · Gs. 80.000"]],
};

/** Example services per business type (previews, empty states). */
export function exampleServices(type: BusinessType) {
  return EXAMPLE_SERVICES[type].map(([name, meta]) => ({ name, meta }));
}

function serviceExample(type: BusinessType) {
  const [first] = exampleServices(type);
  return `${first.name} · ${first.meta}`;
}

export function planExample(type: BusinessType) {
  switch (type) {
    case "gimnasio":
      return "Musculación · Gs. 150.000 por mes";
    case "academia":
      return "Inglés intensivo · Gs. 400.000 cada 3 meses";
    default:
      return "Plan mensual · Gs. 200.000 por mes";
  }
}

export function sectionHelp(section: Section, settings: HelpSettings): SectionHelp {
  const words = vocabularyFor(settings.businessType);
  const client = words.client;
  const service = words.service;
  const both = settings.appointmentsEnabled && settings.membershipsEnabled;

  switch (section) {
    case "home":
      return {
        title: "Inicio",
        subtitle: "Lo importante de hoy",
        what: "Un resumen de lo que pasa hoy y lo que te falta configurar.",
        why: "Empezá el día acá: ves qué atender primero sin recorrer todo.",
        connectsTo: [],
      };
    case "agenda":
      return {
        title: "Agenda",
        subtitle: "Turnos del día",
        what: `Los turnos de cada día: los que reservan tus ${client.many} desde tu link y los que cargás vos.`,
        why: "Confirmás, cancelás o marcás si vinieron. Nunca más dos turnos a la misma hora.",
        connectsTo: ["reminders", "clients"],
      };
    case "cuotas":
      return {
        title: "Cuotas",
        subtitle: "Quién pagó y quién debe",
        what: `Cada período que tus ${client.many} tienen que pagar, con su estado: pagada, por vencer o vencida.`,
        why: "Registrás pagos en segundos y sabés cuánto te deben sin planillas.",
        connectsTo: ["reminders", "plans"],
      };
    case "reminders":
      return {
        title: "Recordatorios",
        subtitle: "Avisos para enviar hoy",
        what: both
          ? "Avisos antes de cada turno y de cada cuota."
          : settings.membershipsEnabled
            ? "Avisos antes de que venza cada cuota y si quedó sin pagar."
            : "Avisos el día antes de cada turno.",
        why: "Por correo salen solos; por WhatsApp los mandás con un toque. Menos olvidos y menos deudas.",
        connectsTo: [settings.appointmentsEnabled ? "agenda" : "cuotas", "settings"],
        connectionHrefs: { settings: "/dashboard/settings?seccion=recordatorios" },
      };
    case "clients":
      return {
        title: capitalize(client.many),
        subtitle: "Contactos e historial",
        what: `Las personas que te visitan, con teléfono, C.I. y todo su historial${settings.appointmentsEnabled ? " de turnos" : ""}${settings.membershipsEnabled ? " y pagos" : ""}.`,
        why: `Les escribís por WhatsApp con un toque${settings.membershipsEnabled ? " y desde su ficha los inscribís en un plan" : ""}.`,
        connectsTo: settings.membershipsEnabled ? ["plans", "cuotas"] : ["agenda"],
      };
    case "services":
      return {
        title: capitalize(service.many),
        subtitle: "Qué ofrecés",
        what: `Lo que tus ${client.many} pueden reservar, con su duración y su precio.`,
        why: "La duración define cuánto tiempo se aparta en tu agenda; el precio aparece en tu link de reservas.",
        connectsTo: ["schedule", "agenda"],
        example: serviceExample(settings.businessType),
      };
    case "schedule":
      return {
        title: "Horarios",
        subtitle: "Cuándo atendés",
        what: "Los días y horas en que atendés, y los días libres (vacaciones, feriados).",
        why: `Tus ${client.many} solo pueden reservar dentro de estos horarios.`,
        connectsTo: ["services", "agenda"],
      };
    case "team":
      return {
        title: "Equipo",
        subtitle: `Quién atiende`,
        what: `Los ${words.staff.many} que atienden turnos, cada uno con su horario y sus ${service.many}.`,
        why: `Tus ${client.many} eligen con quién atenderse, y cada uno ve solo sus turnos.`,
        connectsTo: ["schedule", "services"],
      };
    case "plans":
      return {
        title: "Planes",
        subtitle: "Qué cobrás cada mes",
        what: `Lo que cobrás de forma periódica: precio y cada cuánto se paga.`,
        why: `Inscribís a un ${client.one} en un plan y Agenda arma sus cuotas solo, mes a mes.`,
        connectsTo: ["clients", "cuotas"],
        example: planExample(settings.businessType),
      };
    case "settings":
      return {
        title: "Configuración",
        subtitle: "Datos y reglas",
        what: "Los datos de tu negocio, las reglas de reserva, cuotas y recordatorios.",
        why: "Ajustás cómo funciona Agenda para tu negocio. Lo podés cambiar cuando quieras.",
        connectsTo: [],
      };
  }
}

/** Words that confuse first-time users, explained once. */
export const GLOSSARY = {
  turno: "Una cita reservada: quién viene, a qué, con quién y a qué hora.",
  cuota: "Lo que un cliente tiene que pagar por un período de su plan (por ejemplo, octubre).",
  plan: "Lo que cobrás de forma periódica, con su precio y cada cuánto se paga.",
  inscripcion: "Une a un cliente con un plan. Desde ese día, Agenda genera sus cuotas sola.",
  diaLibre: "Un rango en el que no se toman turnos: vacaciones, un trámite, un feriado.",
  tolerancia: "Los días que esperás después del vencimiento antes de considerar una cuota vencida.",
  link: "La página pública de tu negocio donde tus clientes reservan solos, sin crear cuenta.",
} as const;
