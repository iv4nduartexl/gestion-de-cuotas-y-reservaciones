"use client";

import { useState } from "react";

import { updateMembershipSettingsAction } from "@/app/dashboard/settings/actions";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import { renderReminder } from "@/lib/billing";
import { DEFAULT_REMINDER_TEMPLATE, type GraceUnit } from "@/lib/membership-constants";

const GRACE_PRESETS: { count: number; unit: GraceUnit; label: string }[] = [
  { count: 0, unit: "day", label: "Sin tolerancia (vence el mismo día)" },
  { count: 3, unit: "day", label: "3 días" },
  { count: 5, unit: "day", label: "5 días" },
  { count: 1, unit: "week", label: "1 semana" },
  { count: 10, unit: "day", label: "10 días" },
  { count: 15, unit: "day", label: "15 días" },
  { count: 1, unit: "month", label: "1 mes" },
];
const presetKey = (count: number, unit: GraceUnit) => `${count}-${unit}`;

export function MembershipSettingsForm({
  graceCount,
  graceUnit,
  template,
}: {
  graceCount: number;
  graceUnit: GraceUnit;
  template: string | null;
}) {
  const { state, pending, formProps } = useFormAction(updateMembershipSettingsAction, {});
  const errors = state.errors ?? {};
  const initialPreset = GRACE_PRESETS.some((p) => p.count === graceCount && p.unit === graceUnit) ? presetKey(graceCount, graceUnit) : "custom";
  const [preset, setPreset] = useState(initialPreset);
  const [customCount, setCustomCount] = useState(String(graceCount));
  const [customUnit, setCustomUnit] = useState<GraceUnit>(graceUnit);
  const chosen = preset === "custom" ? null : GRACE_PRESETS.find((p) => presetKey(p.count, p.unit) === preset)!;
  const [text, setText] = useState(template ?? DEFAULT_REMINDER_TEMPLATE);
  const preview = renderReminder(text, { nombre: "María", plan: "Musculación", monto: "Gs. 150.000", vencimiento: "05/10/2026" });

  return (
    <form {...formProps} noValidate className="grid max-w-2xl gap-5">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <Field
        id="grace"
        label="Tolerancia"
        hint="Cuánto tiempo después del vencimiento una cuota pasa a “Vencida”."
        error={errors.graceCount}
      >
        <div className="flex flex-wrap gap-2">
          <NativeSelect id="grace" className="w-full sm:max-w-xs" value={preset} onChange={(event) => setPreset(event.target.value)}>
            {GRACE_PRESETS.map((p) => (
              <NativeSelectOption key={presetKey(p.count, p.unit)} value={presetKey(p.count, p.unit)}>
                {p.label}
              </NativeSelectOption>
            ))}
            <NativeSelectOption value="custom">Otro…</NativeSelectOption>
          </NativeSelect>
          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                aria-label="Cantidad de tolerancia"
                inputMode="numeric"
                className="w-20"
                value={customCount}
                onChange={(event) => setCustomCount(event.target.value.replace(/\D/g, "").slice(0, 3))}
              />
              <NativeSelect aria-label="Unidad de tolerancia" value={customUnit} onChange={(event) => setCustomUnit(event.target.value as GraceUnit)}>
                <NativeSelectOption value="day">días</NativeSelectOption>
                <NativeSelectOption value="week">semanas</NativeSelectOption>
                <NativeSelectOption value="month">meses</NativeSelectOption>
              </NativeSelect>
            </div>
          )}
        </div>
        <input type="hidden" name="graceCount" value={chosen ? chosen.count : customCount} />
        <input type="hidden" name="graceUnit" value={chosen ? chosen.unit : customUnit} />
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
