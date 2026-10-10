import { describe, expect, it } from "vitest";

import { reminderEmail, renderTemplate, whatsappText } from "@/lib/messaging/templates";
import { DEFAULT_APPOINTMENT_TEMPLATE } from "@/lib/reminder-constants";

const appointment = {
  kind: "appointment_24h" as const,
  nombre: "María",
  servicio: "Corte",
  negocio: "Barbería Don Pedro",
  dia: "lunes 12/10",
  hora: "10:00",
  link: "https://agenda.test/barberia/turno/abc",
  direccion: "Av. España 123",
};
const charge = {
  kind: "charge_upcoming" as const,
  nombre: "Juan",
  plan: "Musculación",
  negocio: "Gym",
  monto: "Gs. 150.000",
  vencimiento: "05/10/2026",
  dias: 3,
};
const templates = { appointment: null, overdue: null, defaultAppointment: DEFAULT_APPOINTMENT_TEMPLATE };

describe("templates", () => {
  it("renders placeholders and keeps unknown ones", () => {
    expect(renderTemplate("Hola {nombre} {otro}", { nombre: "Ana" })).toBe("Hola Ana {otro}");
  });

  it("WhatsApp: appointment default and custom template", () => {
    expect(whatsappText(appointment, templates)).toBe(
      "Hola María, te recordamos tu turno de Corte en Barbería Don Pedro el lunes 12/10 a las 10:00. ¡Te esperamos!",
    );
    expect(whatsappText(appointment, { ...templates, appointment: "{nombre}: {hora}" })).toBe("María: 10:00");
  });

  it("WhatsApp: cuota texts per kind; the business template applies to overdue", () => {
    expect(whatsappText(charge, templates)).toContain("vence el 05/10/2026");
    expect(whatsappText({ ...charge, kind: "charge_due" }, templates)).toContain("hoy vence");
    expect(whatsappText({ ...charge, kind: "charge_overdue" }, { ...templates, overdue: "Debés {monto}" })).toBe("Debés Gs. 150.000");
  });

  it("emails include the private link for turnos and escape HTML", () => {
    const email = reminderEmail("maria@example.com", { ...appointment, servicio: "Corte <b>" });
    expect(email.subject).toBe("Tu turno de mañana en Barbería Don Pedro");
    expect(email.text).toContain("Ver o cancelar mi turno: https://agenda.test/barberia/turno/abc");
    expect(email.html).toContain("Corte &lt;b&gt;");
    expect(reminderEmail("x@y.z", { ...charge, kind: "charge_overdue" }).subject).toContain("vencida");
  });
});
