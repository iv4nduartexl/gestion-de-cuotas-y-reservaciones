"use client";

import { useState } from "react";

import { Field } from "@/components/forms/field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { MoneyInput } from "@/components/forms/py-inputs";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SectionCard } from "@/components/ui-kit/section-card";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionState } from "@/lib/actions";
import type { IntervalUnit } from "@/lib/membership-constants";

const INTERVALS: { value: string; label: string }[] = [
  { value: "week-1", label: "Semanal (cada semana)" },
  { value: "week-2", label: "Quincenal (cada 2 semanas)" },
  { value: "month-1", label: "Mensual (cada mes)" },
  { value: "month-2", label: "Bimestral (cada 2 meses)" },
  { value: "month-3", label: "Trimestral (cada 3 meses)" },
  { value: "month-6", label: "Semestral (cada 6 meses)" },
  { value: "month-12", label: "Anual (cada 12 meses)" },
];

export function PlanForm({
  action,
  plan,
  currencyPrefix,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  plan?: { name: string; description: string | null; priceInput: string; intervalUnit: IntervalUnit; intervalCount: number };
  currencyPrefix: string;
  submitLabel: string;
}) {
  const { state, pending, formProps } = useFormAction(action, {});
  const errors = state.errors ?? {};
  const initial = plan ? `${plan.intervalUnit}-${plan.intervalCount}` : "month-1";
  const [interval, setIntervalValue] = useState(initial);
  const options = INTERVALS.some((o) => o.value === initial)
    ? INTERVALS
    : [...INTERVALS, { value: initial, label: `Cada ${plan!.intervalCount} ${plan!.intervalUnit === "month" ? "meses" : "semanas"}` }];
  const [unit, count] = interval.split("-");

  return (
    <form {...formProps} noValidate className="flex max-w-2xl flex-col gap-6">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <SectionCard title="Qué incluye" description="El nombre que vas a ver en las cuotas y en la ficha de cada socio.">
        <div className="grid gap-5">
          <FormField name="name" label="Nombre" placeholder="Musculación mensual" defaultValue={plan?.name} error={errors.name} />
          <TextareaField name="description" label="Descripción" optional rows={2} placeholder="Acceso libre de lunes a sábado." defaultValue={plan?.description ?? ""} error={errors.description} />
        </div>
      </SectionCard>
      <SectionCard title="Precio y frecuencia" description="Cada cuánto se genera una cuota. La primera vence el día de inscripción, y las siguientes ese mismo día de cada período.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="price" label="Precio" error={errors.price} hint="Escribí solo números: los puntos se agregan solos.">
            <MoneyInput id="price" name="price" prefix={currencyPrefix} placeholder="150.000" defaultValue={plan?.priceInput} invalid={!!errors.price} />
          </Field>
          <Field id="interval" label="Frecuencia">
            <NativeSelect id="interval" className="w-full" value={interval} onChange={(event) => setIntervalValue(event.target.value)}>
              {options.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <input type="hidden" name="intervalUnit" value={unit} />
        <input type="hidden" name="intervalCount" value={count} />
        {plan && <p className="text-sm text-muted-foreground">Un nuevo precio se aplica a las próximas inscripciones; las actuales mantienen el suyo.</p>}
      </SectionCard>
      <div className="sticky bottom-24 z-10 flex justify-end md:bottom-6">
        <Button type="submit" size="lg" disabled={pending} className="shadow-lift">
          {pending ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
