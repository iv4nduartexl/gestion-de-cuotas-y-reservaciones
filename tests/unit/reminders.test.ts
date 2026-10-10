import { describe, expect, it } from "vitest";

import { appointmentReminderKinds, channelFor, chargeReminderKind } from "@/lib/jobs/plan-reminders";

const HOUR = 3_600_000;
const now = new Date("2030-01-07T12:00:00Z");
const on = { remindAppointments24h: true, remindAppointments2h: true };

describe("appointment reminder windows", () => {
  it("plans the 24 h reminder for turnos 3–25 h away", () => {
    const in24 = new Date(now.getTime() + 24 * HOUR);
    expect(appointmentReminderKinds(in24, now, on)).toEqual([{ kind: "appointment_24h", scheduledFor: now }]);
    const in25 = new Date(now.getTime() + 25 * HOUR);
    expect(appointmentReminderKinds(in25, now, on)[0].scheduledFor).toEqual(new Date(now.getTime() + HOUR));
    expect(appointmentReminderKinds(new Date(now.getTime() + 2 * HOUR), now, { ...on, remindAppointments2h: false })).toEqual([]);
  });

  it("plans the 2 h reminder only when enabled", () => {
    const in2 = new Date(now.getTime() + 2 * HOUR);
    expect(appointmentReminderKinds(in2, now, on).map((r) => r.kind)).toEqual(["appointment_2h"]);
    expect(appointmentReminderKinds(in2, now, { ...on, remindAppointments2h: false })).toEqual([]);
  });
});

describe("cuota reminder kinds", () => {
  const settings = { remindChargesDaysBefore: 3, remindChargesOnDue: true, remindChargesDaysAfter: 3 };
  const today = "2030-01-10";
  it.each([
    ["2030-01-13", "charge_upcoming"],
    ["2030-01-11", "charge_upcoming"],
    ["2030-01-14", null],
    ["2030-01-10", "charge_due"],
    ["2030-01-08", null],
    ["2030-01-07", "charge_overdue"],
    ["2030-01-01", "charge_overdue"],
    ["2029-12-30", null], // more than a week late: not caught up
  ])("due %s → %s", (due, kind) => {
    expect(chargeReminderKind(due, today, settings)).toBe(kind);
  });

  it("respects disabled settings", () => {
    expect(chargeReminderKind("2030-01-12", today, { ...settings, remindChargesDaysBefore: 0 })).toBeNull();
    expect(chargeReminderKind("2030-01-10", today, { ...settings, remindChargesOnDue: false })).toBeNull();
  });

  it("email when the client has one, otherwise the WhatsApp tray", () => {
    expect(channelFor({ email: "a@b.c" })).toBe("email");
    expect(channelFor({ email: null })).toBe("whatsapp_manual");
    expect(channelFor({ email: "a@b.c", emailOptOutAt: new Date() })).toBe("whatsapp_manual");
  });
});
