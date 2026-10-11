// One-shot confirmation messages passed through a redirect (?aviso=<key>).
// Only known keys are shown, so the URL can't inject arbitrary text.
export const FLASH_MESSAGES = {
  "cliente-creado": "Cliente guardado",
  "servicio-creado": "Servicio creado",
  "persona-creada": "Persona agregada al equipo",
  "turno-creado": "Turno agendado",
  "alquiler-creado": "Alquiler agendado",
  "plan-creado": "Plan creado",
  "inscripcion-creada": "Inscripción creada",
  "cobro-creado": "Cobro creado",
} as const;

export type FlashKey = keyof typeof FLASH_MESSAGES;

export function withFlash(path: string, key: FlashKey) {
  return `${path}${path.includes("?") ? "&" : "?"}aviso=${key}`;
}
