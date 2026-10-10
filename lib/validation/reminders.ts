import { z } from "zod";

import { checkbox, idSchema, optionalText } from "./common";

const days = z.coerce.number().int().min(0).max(30);

/** Settings → Recordatorios. Fields of a disabled product are simply absent. */
export const reminderSettingsSchema = z.object({
  remindAppointments24h: checkbox,
  remindAppointments2h: checkbox,
  appointmentReminderTemplate: optionalText(500),
  remindChargesDaysBefore: days,
  remindChargesOnDue: checkbox,
  remindChargesDaysAfter: days,
});

export const reminderIdsSchema = z.array(idSchema).min(1).max(200);
