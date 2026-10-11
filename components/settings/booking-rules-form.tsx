"use client";

import { useState } from "react";

import { updateBookingRulesAction } from "@/app/dashboard/settings/actions";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { IssueBox } from "@/components/wizard/issue-box";
import { useFormAction } from "@/hooks/use-form-action";
import { bookingRuleIssues } from "@/lib/config-rules";

type Rules = {
  autoConfirmBookings: boolean;
  minNoticeMinutes: number;
  maxDaysAhead: number;
  slotIntervalMinutes: number;
  bufferMinutes: number;
  clientCancelNoticeHours: number;
};

const MIN_NOTICE = [
  [0, "Sin mínimo"],
  [30, "30 minutos antes"],
  [60, "1 hora antes"],
  [120, "2 horas antes"],
  [240, "4 horas antes"],
  [720, "12 horas antes"],
  [1440, "1 día antes"],
  [2880, "2 días antes"],
] as const;
const MAX_DAYS = [[7, "1 semana"], [14, "2 semanas"], [30, "1 mes"], [60, "2 meses"], [90, "3 meses"], [180, "6 meses"]] as const;
const INTERVALS = [[10, "Cada 10 min"], [15, "Cada 15 min"], [20, "Cada 20 min"], [30, "Cada 30 min"], [60, "Cada 1 hora"]] as const;
const BUFFERS = [[0, "Sin pausa"], [5, "5 minutos"], [10, "10 minutos"], [15, "15 minutos"], [30, "30 minutos"]] as const;
const CANCEL = [[0, "Hasta la hora del turno"], [2, "Hasta 2 horas antes"], [4, "Hasta 4 horas antes"], [12, "Hasta 12 horas antes"], [24, "Hasta 1 día antes"], [48, "Hasta 2 días antes"]] as const;

function withCurrent(options: readonly (readonly [number, string])[], current: number, format: (n: number) => string) {
  return options.some(([value]) => value === current) ? options : [...options, [current, format(current)] as const];
}

export function BookingRulesForm({ rules, shortestServiceMinutes }: { rules: Rules; shortestServiceMinutes: number | null }) {
  const { state, pending, formProps } = useFormAction(updateBookingRulesAction, {});
  const [autoConfirm, setAutoConfirm] = useState(rules.autoConfirmBookings);
  const [values, setValues] = useState(rules);
  const errors = state.errors ?? {};
  // Combinations that can't work are blocked here (and again on the server).
  const issues = bookingRuleIssues(values, { shortestServiceMinutes });

  const select = (name: Exclude<keyof Rules, "autoConfirmBookings">, label: string, hint: string, options: readonly (readonly [number, string])[]) => (
    <Field id={name} label={label} hint={hint} error={errors[name]}>
      <NativeSelect
        id={name}
        name={name}
        className="w-full"
        value={String(values[name])}
        onChange={(event) => setValues((current) => ({ ...current, [name]: Number(event.target.value) }))}
      >
        {withCurrent(options, Number(values[name]), (n) => String(n)).map(([value, text]) => (
          <NativeSelectOption key={value} value={value}>
            {text}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );

  return (
    <form {...formProps} noValidate className="grid max-w-2xl gap-5">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <input type="hidden" name="autoConfirmBookings" value={String(autoConfirm)} />
      <Label className="flex cursor-pointer items-start gap-4 rounded-2xl border bg-card p-4 font-normal leading-normal">
        <span className="flex flex-1 flex-col gap-1">
          <span className="font-bold">Confirmar turnos automáticamente</span>
          <span className="text-sm text-muted-foreground">
            {autoConfirm
              ? "Las reservas online quedan confirmadas al instante."
              : "Las reservas online llegan como “pendientes” y las confirmás desde la Agenda. El horario queda apartado igual."}
          </span>
        </span>
        <Switch checked={autoConfirm} onCheckedChange={setAutoConfirm} aria-label="Confirmar turnos automáticamente" />
      </Label>
      <div className="grid gap-5 sm:grid-cols-2">
        {select("minNoticeMinutes", "Anticipación mínima", "Para no recibir turnos de último momento.", MIN_NOTICE)}
        {select("maxDaysAhead", "Hasta cuándo se puede reservar", "Desde hoy en adelante.", MAX_DAYS)}
        {select("clientCancelNoticeHours", "Cancelación online", "Hasta cuándo el cliente puede cancelar desde su link.", CANCEL)}
      </div>
      <details className="rounded-2xl border p-4" open={issues.some((i) => i.field === "slotIntervalMinutes")}>
        <summary className="cursor-pointer text-sm font-semibold">Más opciones</summary>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {select("slotIntervalMinutes", "Horarios que se ofrecen", "08:00, 08:15, 08:30… según lo que elijas.", INTERVALS)}
          {select("bufferMinutes", "Pausa entre turnos", "Tiempo libre después de cada turno.", BUFFERS)}
        </div>
      </details>
      <IssueBox issues={issues} onFix={(fix) => setValues((current) => ({ ...current, ...fix.patch }))} />
      <div>
        <Button type="submit" disabled={pending || issues.length > 0}>
          {pending ? "Guardando…" : "Guardar reglas"}
        </Button>
      </div>
    </form>
  );
}
