"use client";

import { useState } from "react";

import { Field } from "@/components/forms/field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { MoneyInput } from "@/components/forms/py-inputs";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { EntityAvatar } from "@/components/ui-kit/entity-avatar";
import { SectionCard } from "@/components/ui-kit/section-card";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionState } from "@/lib/actions";
import { formatDuration } from "@/lib/datetime";
import { SERVICE_DURATIONS } from "@/lib/validation/services";

export function ServiceForm({
  action,
  service,
  staffOptions,
  showStaff,
  staffNoun,
  serviceNoun,
  currencyPrefix,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  service?: {
    name: string;
    description: string | null;
    durationMinutes: number;
    priceInput: string;
    staffIds: string[];
  };
  staffOptions: { id: string; name: string }[];
  /** Team mode only; in solo mode the owner does every service. */
  showStaff: boolean;
  staffNoun: string;
  serviceNoun: string;
  currencyPrefix: string;
  submitLabel: string;
}) {
  const { state, pending, formProps } = useFormAction(action, {});
  const errors = state.errors ?? {};
  const [selectedStaff, setSelectedStaff] = useState<string[]>(
    service?.staffIds ?? staffOptions.map((option) => option.id),
  );
  const durations =
    service && !SERVICE_DURATIONS.includes(service.durationMinutes)
      ? [...SERVICE_DURATIONS, service.durationMinutes].sort((a, b) => a - b)
      : SERVICE_DURATIONS;

  return (
    <form {...formProps} noValidate className="flex max-w-2xl flex-col gap-6">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}

      <SectionCard title="Qué es" description="El nombre que van a ver tus clientes al reservar.">
        <div className="grid gap-5">
          <FormField
            name="name"
            label="Nombre"
            placeholder="Corte clásico"
            defaultValue={service?.name}
            error={errors.name}
          />
          <TextareaField
            name="description"
            label="Descripción"
            optional
            placeholder="Incluye lavado y peinado."
            defaultValue={service?.description ?? ""}
            rows={2}
            error={errors.description}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Duración y precio"
        description={`La duración define cuánto tiempo se reserva en la agenda para cada ${serviceNoun}.`}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="durationMinutes" label="Duración" error={errors.durationMinutes}>
            <NativeSelect
              id="durationMinutes"
              name="durationMinutes"
              className="w-full"
              defaultValue={String(service?.durationMinutes ?? 30)}
            >
              {durations.map((minutes) => (
                <NativeSelectOption key={minutes} value={minutes}>
                  {formatDuration(minutes)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="price" label="Precio" error={errors.price} hint="Escribí solo números: los puntos se agregan solos.">
            <MoneyInput
              id="price"
              name="price"
              prefix={currencyPrefix}
              placeholder="50.000"
              defaultValue={service?.priceInput}
              invalid={!!errors.price}
            />
          </Field>
        </div>
      </SectionCard>

      {showStaff && (
        <SectionCard title="Quién lo realiza" description={`Solo estos ${staffNoun} van a aparecer al reservar este ${serviceNoun}.`}>
          {staffOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay personas en el equipo. Podés asignarlas después.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {staffOptions.map((option) => {
                const checked = selectedStaff.includes(option.id);
                return (
                  <Label
                    key={option.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 font-semibold has-data-checked:border-primary has-data-checked:bg-primary-soft/40"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        setSelectedStaff((current) =>
                          value === true ? [...current, option.id] : current.filter((id) => id !== option.id),
                        )
                      }
                    />
                    <EntityAvatar name={option.name} size="sm" />
                    {option.name}
                    {checked && <input type="hidden" name="staffIds" value={option.id} />}
                  </Label>
                );
              })}
            </div>
          )}
          {errors.staffIds && <p className="text-sm text-destructive">{errors.staffIds}</p>}
        </SectionCard>
      )}

      <div className="sticky bottom-24 z-10 flex justify-end md:bottom-6">
        <Button type="submit" size="lg" disabled={pending} className="shadow-lift">
          {pending ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
