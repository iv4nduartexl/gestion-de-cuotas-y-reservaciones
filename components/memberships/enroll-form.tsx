"use client";

import { useState } from "react";

import { enrollAction } from "@/app/dashboard/cuotas/actions";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { DatePicker, MoneyInput } from "@/components/forms/py-inputs";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { HelpHint } from "@/components/ui-kit/help-hint";
import { GLOSSARY } from "@/lib/help-content";
import { useFormAction } from "@/hooks/use-form-action";
import { intervalLabel, type IntervalUnit } from "@/lib/membership-constants";
import { formatMoney } from "@/lib/money";

type PlanOption = { id: string; name: string; price: number; currency: string; intervalUnit: IntervalUnit; intervalCount: number };

export function EnrollForm({
  clientId,
  plans,
  today,
  currencyPrefix,
}: {
  clientId: string;
  plans: PlanOption[];
  today: string;
  currencyPrefix: string;
}) {
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [startDate, setStartDate] = useState(today);
  const { state, pending, formProps } = useFormAction(enrollAction.bind(null, clientId), {});
  const errors = state.errors ?? {};
  const plan = plans.find((p) => p.id === planId);

  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.message) setOpen(false);
  }

  if (!open) {
    return (
      <span className="flex items-center gap-1.5">
        <Button type="button" variant="soft" className="w-fit" onClick={() => setOpen(true)}>
          Inscribir en un plan
        </Button>
        <HelpHint label="¿Qué es inscribir?">{GLOSSARY.inscripcion}</HelpHint>
      </span>
    );
  }

  return (
    <form {...formProps} noValidate className="grid gap-4 rounded-2xl border bg-muted/30 p-4">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <input type="hidden" name="planId" value={planId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="planId" label="Plan" error={errors.planId}>
          <NativeSelect id="planId" className="w-full" value={planId} onChange={(event) => setPlanId(event.target.value)}>
            {plans.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.name} · {formatMoney(p.price, p.currency)} {intervalLabel(p.intervalUnit, p.intervalCount)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field id="startDate" label="Desde" error={errors.startDate} hint="La cuota vence este mismo día de cada período.">
          <DatePicker id="startDate" name="startDate" value={startDate} onChange={setStartDate} />
        </Field>
        <Field
          id="price"
          label="Precio especial"
          optional
          error={errors.price}
          hint={plan ? `Dejalo vacío para cobrar ${formatMoney(plan.price, plan.currency)}.` : undefined}
        >
          <MoneyInput id="price" name="price" prefix={currencyPrefix} invalid={!!errors.price} />
        </Field>
      </div>
      {startDate < today && (
        <p className="text-sm text-muted-foreground">
          La fecha es anterior a hoy: se van a generar las cuotas de los períodos que ya pasaron.
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !planId}>
          {pending ? "Inscribiendo…" : "Inscribir"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
