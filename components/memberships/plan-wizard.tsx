"use client";

import { CalendarCheckIcon, CalendarClockIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { createPlanAction, updatePlanAction } from "@/app/dashboard/planes/actions";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/py-inputs";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceCard, Wizard, type WizardStep } from "@/components/wizard/wizard";
import { addInterval, periodsFor } from "@/lib/billing";
import { planIssues } from "@/lib/config-rules";
import { formatCalendarDate } from "@/lib/datetime";
import { intervalLabel, type IntervalUnit } from "@/lib/membership-constants";
import { formatAmountInput, formatMoney, parseMoneyInput } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { PlanWizardValues } from "@/lib/wizard-values";

const PRESETS: { unit: IntervalUnit; count: number; label: string }[] = [
  { unit: "week", count: 1, label: "Cada semana" },
  { unit: "week", count: 2, label: "Cada 15 días" },
  { unit: "month", count: 1, label: "Cada mes" },
  { unit: "month", count: 3, label: "Cada 3 meses" },
  { unit: "month", count: 6, label: "Cada 6 meses" },
  { unit: "year", count: 1, label: "Cada año" },
];

export function PlanWizard({
  initial,
  edit,
  currency,
  currencyPrefix,
  today,
  example,
  clientWord,
}: {
  initial: PlanWizardValues;
  edit?: { id: string; step: string };
  currency: string;
  currencyPrefix: string;
  today: string;
  example: string;
  clientWord: string;
}) {
  const router = useRouter();
  const isPreset = (v: PlanWizardValues) => PRESETS.some((p) => p.unit === v.intervalUnit && p.count === v.intervalCount);

  const steps: WizardStep<PlanWizardValues>[] = [
    {
      id: "nombre",
      label: "Nombre",
      title: "¿Cómo se llama el plan?",
      why: `Es lo que vas a ver en las cuotas de cada ${clientWord}. Por ejemplo: “${example}”.`,
      fields: ["name", "description"],
      issues: (v) => (v.name.trim().length < 2 ? [{ field: "name", message: "Escribí el nombre (al menos 2 letras).", fixes: [] }] : []),
      render: ({ values, set }) => (
        <div className="grid gap-4">
          <Field id="name" label="Nombre">
            <Input id="name" autoFocus value={values.name} placeholder={example.split(" · ")[0]} onChange={(event) => set({ name: event.target.value })} />
          </Field>
          <Field id="description" label="Qué incluye" optional>
            <Textarea id="description" rows={2} value={values.description} placeholder="Acceso libre de lunes a sábado." onChange={(event) => set({ description: event.target.value })} />
          </Field>
        </div>
      ),
    },
    {
      id: "precio",
      label: "Precio",
      title: "¿Cuánto se cobra cada vez?",
      why: "El monto de cada cuota. Escribí solo números: los puntos se agregan solos.",
      fields: ["price"],
      issues: (v) => planIssues({ price: v.price ?? 0, intervalCount: v.intervalCount }).filter((i) => i.field === "price"),
      render: ({ values, set }) => (
        <Field id="price" label="Precio de cada cuota">
          <MoneyInput
            id="price"
            prefix={currencyPrefix}
            placeholder="150.000"
            defaultValue={values.price === null ? "" : formatAmountInput(values.price, currency)}
            onValueChange={(text) => set({ price: text ? parseMoneyInput(text, currency) : null })}
          />
        </Field>
      ),
    },
    {
      id: "frecuencia",
      label: "Cada cuánto",
      title: "¿Cada cuánto se cobra?",
      why: "Cada vez que pasa este tiempo, Agenda arma una cuota nueva sola.",
      fields: ["intervalUnit", "intervalCount"],
      issues: (v) => planIssues({ price: v.price ?? 1, intervalCount: v.intervalCount }).filter((i) => i.field === "intervalCount"),
      render: ({ values, set }) => (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Cada cuánto">
            {PRESETS.map((preset) => {
              const on = values.intervalUnit === preset.unit && values.intervalCount === preset.count;
              return (
                <button
                  key={preset.label}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set({ intervalUnit: preset.unit, intervalCount: preset.count })}
                  className={cn("h-12 rounded-2xl border-2 text-sm font-bold", on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <div className={cn("flex flex-wrap items-center gap-2 rounded-2xl p-3", !isPreset(values) ? "bg-primary-soft/50" : "bg-muted/50")}>
            <span className="text-sm font-semibold">Otro: cada</span>
            <Input
              aria-label="Cada cuántos"
              inputMode="numeric"
              className="w-20"
              value={String(values.intervalCount)}
              onChange={(event) => set({ intervalCount: Number(event.target.value.replace(/\D/g, "").slice(0, 3)) || 0 })}
            />
            <NativeSelect aria-label="Unidad" value={values.intervalUnit} onChange={(event) => set({ intervalUnit: event.target.value as IntervalUnit })}>
              <NativeSelectOption value="day">días</NativeSelectOption>
              <NativeSelectOption value="week">semanas</NativeSelectOption>
              <NativeSelectOption value="month">meses</NativeSelectOption>
              <NativeSelectOption value="year">años</NativeSelectOption>
            </NativeSelect>
          </div>
          {values.intervalCount >= 1 && <p className="text-sm text-muted-foreground">Se cobra {intervalLabel(values.intervalUnit, values.intervalCount)}.</p>}
        </div>
      ),
    },
    {
      id: "cobro",
      label: "Cuándo se paga",
      title: "¿Cuándo se paga cada cuota?",
      why: `Al inscribir a cada ${clientWord} lo podés cambiar, elegir otra fecha o regalarle el primer período.`,
      fields: ["billingTiming"],
      render: ({ values, set }) => {
        const end = addInterval(today, values.intervalUnit, values.intervalCount);
        return (
          <div className="grid gap-3" role="radiogroup" aria-label="Cuándo se paga">
            <ChoiceCard
              selected={values.billingTiming === "advance"}
              onSelect={() => set({ billingTiming: "advance" })}
              icon={<CalendarCheckIcon className="size-5" />}
              title="Por adelantado"
              text={`Paga al empezar cada período. Si se inscribe hoy, paga hoy (${formatCalendarDate(today, "dd/MM")}).`}
            />
            <ChoiceCard
              selected={values.billingTiming === "arrears"}
              onSelect={() => set({ billingTiming: "arrears" })}
              icon={<CalendarClockIcon className="size-5" />}
              title="A período vencido"
              text={`Primero usa, después paga. Si se inscribe hoy, paga el ${formatCalendarDate(end, "dd/MM")}.`}
            />
          </div>
        );
      },
    },
  ];

  function review(values: PlanWizardValues) {
    const dues = periodsFor({
      startDate: today,
      unit: values.intervalUnit,
      count: values.intervalCount,
      until: addInterval(today, values.intervalUnit, values.intervalCount * 4),
      timing: values.billingTiming,
    })
      .slice(0, 3)
      .map((period) => formatCalendarDate(period.dueDate, "dd/MM/yyyy"));
    return (
      <div className="grid gap-3">
        <div className="rounded-2xl border-2 bg-background p-4">
          <p className="font-bold">{values.name}</p>
          {values.description && <p className="text-sm text-muted-foreground">{values.description}</p>}
          <p className="mt-1 text-lg font-extrabold text-primary tabular">
            {formatMoney(values.price ?? 0, currency)} <span className="text-sm font-semibold text-muted-foreground">{intervalLabel(values.intervalUnit, values.intervalCount)}</span>
          </p>
        </div>
        <p className="rounded-2xl bg-muted/60 p-4 text-sm">
          Si alguien se inscribe hoy, sus primeras cuotas vencen el <strong>{dues.join(", ")}</strong>.
        </p>
      </div>
    );
  }

  async function onSubmit(values: PlanWizardValues) {
    const data = new FormData();
    data.set("name", values.name);
    data.set("description", values.description);
    data.set("price", values.price === null ? "" : formatAmountInput(values.price, currency));
    data.set("intervalUnit", values.intervalUnit);
    data.set("intervalCount", String(values.intervalCount));
    data.set("billingTiming", values.billingTiming);
    if (edit) {
      const result = await updatePlanAction(edit.id, {}, data);
      if (!result.errors) router.push(`/dashboard/planes/${edit.id}`);
      return result;
    }
    return createPlanAction({}, data);
  }

  return (
    <Wizard
      steps={steps}
      initial={initial}
      review={review}
      onSubmit={onSubmit}
      submitLabel={edit ? "Guardar cambio" : "Crear plan"}
      cancelHref={edit ? `/dashboard/planes/${edit.id}` : "/dashboard/planes"}
      editStep={edit?.step}
      successMessage={edit ? "Cambio guardado" : undefined}
    />
  );
}
