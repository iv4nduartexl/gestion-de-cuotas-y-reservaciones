"use client";

import { useState } from "react";

import { updateMembershipSettingsAction } from "@/app/dashboard/settings/actions";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import { renderReminder } from "@/lib/billing";
import { DEFAULT_REMINDER_TEMPLATE } from "@/lib/membership-constants";

const GRACE = [0, 1, 2, 3, 5, 7, 10, 15];

export function MembershipSettingsForm({ graceDays, template }: { graceDays: number; template: string | null }) {
  const { state, pending, formProps } = useFormAction(updateMembershipSettingsAction, {});
  const errors = state.errors ?? {};
  const [text, setText] = useState(template ?? DEFAULT_REMINDER_TEMPLATE);
  const preview = renderReminder(text, { nombre: "María", plan: "Musculación", monto: "Gs. 150.000", vencimiento: "05/10/2026" });

  return (
    <form {...formProps} noValidate className="grid max-w-2xl gap-5">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <Field id="graceDays" label="Días de tolerancia" hint="Cuántos días después del vencimiento una cuota pasa a “Vencida”." error={errors.graceDays}>
        <NativeSelect id="graceDays" name="graceDays" className="w-full sm:max-w-xs" defaultValue={String(graceDays)}>
          {(GRACE.includes(graceDays) ? GRACE : [...GRACE, graceDays].sort((a, b) => a - b)).map((days) => (
            <NativeSelectOption key={days} value={days}>
              {days === 0 ? "Sin tolerancia (vence el mismo día)" : `${days} día${days === 1 ? "" : "s"}`}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field
        id="paymentReminderTemplate"
        label="Mensaje de recordatorio por WhatsApp"
        error={errors.paymentReminderTemplate}
        hint="Usá {nombre}, {plan}, {monto} y {vencimiento}: se completan solos."
      >
        <Textarea id="paymentReminderTemplate" name="paymentReminderTemplate" rows={3} maxLength={500} value={text} onChange={(event) => setText(event.target.value)} />
      </Field>
      <div className="rounded-2xl bg-success-soft/60 p-4 text-sm">
        <span className="mb-1 block text-xs font-bold tracking-wide text-success-foreground uppercase">Vista previa</span>
        {preview}
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
