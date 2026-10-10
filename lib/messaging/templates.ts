// Reminder texts (Spanish). WhatsApp texts can be customized per business.

import type { ReminderKind } from "@/lib/reminder-constants";

/** Replaces {placeholders}; unknown ones are left as typed. */
export function renderTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export type AppointmentReminderData = {
  kind: "appointment_24h" | "appointment_2h";
  nombre: string;
  servicio: string;
  negocio: string;
  dia: string; // "lunes 12/10"
  hora: string; // "10:00"
  link: string | null; // client's private turno link (online bookings)
  direccion: string | null;
};

export type ChargeReminderData = {
  kind: "charge_upcoming" | "charge_due" | "charge_overdue";
  nombre: string;
  plan: string;
  negocio: string;
  monto: string; // "Gs. 150.000"
  vencimiento: string; // "05/10/2026"
  dias: number; // days until due (upcoming) or since due (overdue)
};

function isAppointment(data: AppointmentReminderData | ChargeReminderData): data is AppointmentReminderData {
  return data.kind === "appointment_24h" || data.kind === "appointment_2h";
}

const CHARGE_TEXTS: Record<ChargeReminderData["kind"], string> = {
  charge_upcoming:
    "Hola {nombre}, te recordamos que tu cuota de {plan} en {negocio} por {monto} vence el {vencimiento}. ¡Gracias!",
  charge_due: "Hola {nombre}, hoy vence tu cuota de {plan} en {negocio} por {monto}. ¡Gracias!",
  charge_overdue:
    "Hola {nombre}, te recordamos que tu cuota de {plan} por {monto} venció el {vencimiento}. ¡Gracias!",
};

/** WhatsApp text: business template where it applies, otherwise the default. */
export function whatsappText(
  data: AppointmentReminderData | ChargeReminderData,
  templates: { appointment: string | null; overdue: string | null; defaultAppointment: string },
) {
  if (isAppointment(data)) {
    return renderTemplate(templates.appointment || templates.defaultAppointment, {
      nombre: data.nombre,
      servicio: data.servicio,
      negocio: data.negocio,
      dia: data.dia,
      hora: data.hora,
    });
  }
  const template = data.kind === "charge_overdue" && templates.overdue ? templates.overdue : CHARGE_TEXTS[data.kind];
  return renderTemplate(template, {
    nombre: data.nombre,
    plan: data.plan,
    negocio: data.negocio,
    monto: data.monto,
    vencimiento: data.vencimiento,
  });
}

/**
 * Email (subject, text, html, headers) for a reminder. `unsubscribe` adds a
 * footer link (a page for people) and the List-Unsubscribe headers pointing
 * to the one-click POST endpoint (RFC 8058) that mail apps use.
 */
export function reminderEmail(
  to: string,
  data: AppointmentReminderData | ChargeReminderData,
  { unsubscribe }: { unsubscribe?: { page: string; oneClick: string } } = {},
) {
  const unsubscribeUrl = unsubscribe?.page;
  let subject: string;
  let lines: string[];
  let action: { label: string; url: string } | null = null;

  if (isAppointment(data)) {
    subject = data.kind === "appointment_24h" ? `Tu turno de mañana en ${data.negocio}` : `Tu turno de hoy en ${data.negocio}`;
    lines = [
      `Hola ${data.nombre},`,
      `Te recordamos tu turno de ${data.servicio} el ${data.dia} a las ${data.hora}.`,
      ...(data.direccion ? [`Dirección: ${data.direccion}.`] : []),
      "Si no podés venir, avisanos con tiempo.",
    ];
    if (data.link) action = { label: "Ver o cancelar mi turno", url: data.link };
  } else {
    subject =
      data.kind === "charge_upcoming"
        ? `Tu cuota en ${data.negocio} vence el ${data.vencimiento}`
        : data.kind === "charge_due"
          ? `Hoy vence tu cuota en ${data.negocio}`
          : `Tu cuota en ${data.negocio} está vencida`;
    lines = [
      `Hola ${data.nombre},`,
      data.kind === "charge_overdue"
        ? `Tu cuota de ${data.plan} por ${data.monto} venció el ${data.vencimiento}.`
        : `Tu cuota de ${data.plan} por ${data.monto} vence el ${data.vencimiento}.`,
      "Si ya pagaste, ignorá este mensaje. ¡Gracias!",
    ];
  }

  const footer = unsubscribeUrl ? `¿No querés recibir estos recordatorios por correo? Date de baja: ${unsubscribeUrl}` : null;
  const text = [...lines, ...(action ? ["", `${action.label}: ${action.url}`] : []), ...(footer ? ["", "—", footer] : [])].join("\n");
  const html = [
    ...lines.map((line) => `<p>${escapeHtml(line)}</p>`),
    ...(action ? [`<p><a href="${escapeHtml(action.url)}">${escapeHtml(action.label)}</a></p>`] : []),
    ...(unsubscribeUrl
      ? [
          `<p style="color:#6b7280;font-size:12px">¿No querés recibir estos recordatorios por correo? <a href="${escapeHtml(unsubscribeUrl)}">Darme de baja</a></p>`,
        ]
      : []),
  ].join("\n");
  const headers = unsubscribeUrl
    ? { "List-Unsubscribe": `<${unsubscribe!.oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
    : undefined;
  return { to, subject, text, html, headers };
}

/** Short reason shown in the tray. */
export function reminderReason(kind: ReminderKind) {
  return {
    appointment_24h: "Turno mañana",
    appointment_2h: "Turno en 2 horas",
    charge_upcoming: "Cuota por vencer",
    charge_due: "Cuota vence hoy",
    charge_overdue: "Cuota vencida",
  }[kind];
}
