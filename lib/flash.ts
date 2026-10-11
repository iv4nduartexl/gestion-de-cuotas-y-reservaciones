// One-shot confirmation messages passed through a redirect (?aviso=<key>).
// Only known keys are shown, so the URL can't inject arbitrary text.
export const FLASH_MESSAGES = {
  "cliente-creado": "Cliente guardado",
  "servicio-creado": "Servicio creado",
  "persona-creada": "Persona agregada al equipo",
  "turno-creado": "Turno agendado",
  "alquiler-creado": "Alquiler agendado",
  "turno-cambiado": "Cambios guardados",
  "cuota-cambiada": "Cuota actualizada",
  "cuota-dividida": "Cuota dividida en partes",
  "pago-editado": "Pago corregido",
  "membresia-cambiada": "Membresía actualizada",
  "plan-cambiado": "Plan cambiado",
  "plan-creado": "Plan creado",
  "inscripcion-creada": "Inscripción creada",
  "cobro-creado": "Cobro creado",
} as const;

export type FlashKey = keyof typeof FLASH_MESSAGES;

export function withFlash(path: string, key: FlashKey) {
  return `${path}${path.includes("?") ? "&" : "?"}aviso=${key}`;
}
