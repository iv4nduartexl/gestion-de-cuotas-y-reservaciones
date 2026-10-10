// Business types drive defaults (which products are on) and the wording the
// UI uses ("Pacientes" in a clinic, "Socios" in a gym...). No dependencies:
// shared by the database schema, server and client code.

export const BUSINESS_TYPES = [
  "barberia",
  "salon",
  "clinica",
  "estetica",
  "gimnasio",
  "academia",
  "otro",
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const TEAM_MODES = ["solo", "team"] as const;
export type TeamMode = (typeof TEAM_MODES)[number];

type Noun = { one: string; many: string };

export type Vocabulary = {
  client: Noun;
  staff: Noun;
  service: Noun;
};

export type BusinessTypeInfo = {
  label: string;
  hint: string;
  appointments: boolean;
  memberships: boolean;
  vocabulary: Vocabulary;
};

const clients: Noun = { one: "cliente", many: "clientes" };
const team: Noun = { one: "profesional", many: "profesionales" };
const services: Noun = { one: "servicio", many: "servicios" };

export const BUSINESS_TYPE_INFO: Record<BusinessType, BusinessTypeInfo> = {
  barberia: {
    label: "Barbería",
    hint: "Cortes y barba con turno.",
    appointments: true,
    memberships: false,
    vocabulary: { client: clients, staff: { one: "barbero", many: "barberos" }, service: services },
  },
  salon: {
    label: "Peluquería o salón",
    hint: "Color, peinados, uñas.",
    appointments: true,
    memberships: false,
    vocabulary: { client: clients, staff: { one: "estilista", many: "estilistas" }, service: services },
  },
  clinica: {
    label: "Clínica o consultorio",
    hint: "Consultas con tus pacientes.",
    appointments: true,
    memberships: false,
    vocabulary: {
      client: { one: "paciente", many: "pacientes" },
      staff: team,
      service: { one: "consulta", many: "consultas" },
    },
  },
  estetica: {
    label: "Estética o spa",
    hint: "Tratamientos y masajes.",
    appointments: true,
    memberships: false,
    vocabulary: { client: clients, staff: team, service: { one: "tratamiento", many: "tratamientos" } },
  },
  gimnasio: {
    label: "Gimnasio",
    hint: "Socios y cuotas mensuales.",
    appointments: false,
    memberships: true,
    vocabulary: {
      client: { one: "socio", many: "socios" },
      staff: { one: "entrenador", many: "entrenadores" },
      service: { one: "clase", many: "clases" },
    },
  },
  academia: {
    label: "Academia",
    hint: "Danza, idiomas, música: alumnos y clases.",
    appointments: true,
    memberships: true,
    vocabulary: {
      client: { one: "alumno", many: "alumnos" },
      staff: { one: "profesor", many: "profesores" },
      service: { one: "clase", many: "clases" },
    },
  },
  otro: {
    label: "Otro rubro",
    hint: "Elegís qué usar en el próximo paso.",
    appointments: true,
    memberships: false,
    vocabulary: { client: clients, staff: team, service: services },
  },
};

export function vocabularyFor(type: BusinessType): Vocabulary {
  return BUSINESS_TYPE_INFO[type].vocabulary;
}

export function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
