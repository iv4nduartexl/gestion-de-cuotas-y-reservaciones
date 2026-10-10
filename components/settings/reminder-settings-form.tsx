"use client";

import Link from "next/link";
import { useState } from "react";

import { updateReminderSettingsAction } from "@/app/dashboard/settings/actions";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import { renderTemplate } from "@/lib/messaging/templates";
import { DEFAULT_APPOINTMENT_TEMPLATE } from "@/lib/reminder-constants";

type Settings = {
  remindAppointments24h: boolean;
  remindAppointments2h: boolean;
  appointmentReminderTemplate: string | null;
  remindChargesDaysBefore: number;
  remindChargesOnDue: boolean;
  remindChargesDaysAfter: number;
};

const BEFORE = [[0, "No avisar antes"], [1, "1 día antes"], [2, "2 días antes"], [3, "3 días antes"], [5, "5 días antes"], [7, "1 semana antes"]] as const;
const AFTER = [[0, "No avisar"], [1, "1 día después"], [3, "3 días después"], [5, "5 días después"], [7, "1 semana después"]] as const;

function withCurrent(options: readonly (readonly [number, string])[], current: number) {
  return options.some(([value]) => value === current) ? options : [...options, [current, `${current} días`] as const];
}

function Toggle({ name, title, description, checked, onChange }: { name: string; title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <Label className="flex cursor-pointer items-start gap-4 rounded-2xl border bg-card p-4 font-normal leading-normal">
      <input type="hidden" name={name} value={String(checked)} />
      <span className="flex flex-1 flex-col gap-1">
        <span className="font-bold">{title}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
    </Label>
  );
}

export function ReminderSettingsForm({
  settings,
  appointments,
  memberships,
  businessName,
}: {
  settings: Settings;
  appointments: boolean;
  memberships: boolean;
  businessName: string;
}) {
  const { state, pending, formProps } = useFormAction(updateReminderSettingsAction, {});
  const errors = state.errors ?? {};
  const [day, setDay] = useState(settings.remindAppointments24h);
  const [hours, setHours] = useState(settings.remindAppointments2h);
  const [onDue, setOnDue] = useState(settings.remindChargesOnDue);
  const [text, setText] = useState(settings.appointmentReminderTemplate ?? DEFAULT_APPOINTMENT_TEMPLATE);
  const preview = renderTemplate(text, { nombre: "María", servicio: "Corte", negocio: businessName, dia: "lunes 12/10", hora: "10:00" });

  return (
    <form {...formProps} noValidate className="grid max-w-2xl gap-6">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <p className="rounded-2xl bg-primary-soft/60 p-4 text-sm leading-relaxed">
        <strong>Cómo llegan:</strong> si el cliente tiene correo cargado, el recordatorio le llega solo por correo. Si no, aparece en{" "}
        <strong>Recordatorios</strong> para que lo mandes por WhatsApp con un toque.
      </p>

      {appointments && (
        <fieldset className="grid gap-3">
          <legend className="mb-3 text-sm font-bold tracking-wide text-muted-foreground uppercase">Turnos</legend>
          <Toggle name="remindAppointments24h" title="Recordar el día anterior" description="Un día antes del turno (ideal para evitar que se olviden)." checked={day} onChange={setDay} />
          <Toggle name="remindAppointments2h" title="Recordar 2 horas antes" description="Un aviso extra el mismo día, cerca de la hora." checked={hours} onChange={setHours} />
          <Field
            id="appointmentReminderTemplate"
            label="Mensaje de WhatsApp para turnos"
            error={errors.appointmentReminderTemplate}
            hint="Usá {nombre}, {servicio}, {negocio}, {dia} y {hora}: se completan solos."
          >
            <Textarea id="appointmentReminderTemplate" name="appointmentReminderTemplate" rows={3} maxLength={500} value={text} onChange={(event) => setText(event.target.value)} />
          </Field>
          <div className="rounded-2xl bg-success-soft/60 p-4 text-sm">
            <span className="mb-1 block text-xs font-bold tracking-wide text-success-foreground uppercase">Vista previa</span>
            {preview}
          </div>
        </fieldset>
      )}

      {memberships && (
        <fieldset className="grid gap-3">
          <legend className="mb-3 text-sm font-bold tracking-wide text-muted-foreground uppercase">Cuotas</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="remindChargesDaysBefore" label="Antes del vencimiento" error={errors.remindChargesDaysBefore}>
              <NativeSelect id="remindChargesDaysBefore" name="remindChargesDaysBefore" className="w-full" defaultValue={String(settings.remindChargesDaysBefore)}>
                {withCurrent(BEFORE, settings.remindChargesDaysBefore).map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field id="remindChargesDaysAfter" label="Si sigue sin pagar" error={errors.remindChargesDaysAfter}>
              <NativeSelect id="remindChargesDaysAfter" name="remindChargesDaysAfter" className="w-full" defaultValue={String(settings.remindChargesDaysAfter)}>
                {withCurrent(AFTER, settings.remindChargesDaysAfter).map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Toggle name="remindChargesOnDue" title="Recordar el día del vencimiento" description="A las 9 de la mañana del día en que vence la cuota." checked={onDue} onChange={setOnDue} />
          <p className="text-sm text-muted-foreground">
            El mensaje de cuotas vencidas se cambia en{" "}
            <Link href="/dashboard/settings?seccion=cuotas" className="font-semibold text-primary underline-offset-4 hover:underline">
              Configuración → Cuotas
            </Link>
            .
          </p>
        </fieldset>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
