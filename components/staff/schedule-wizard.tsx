"use client";

import { CoffeeIcon, SunIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { saveWeeklyScheduleAction } from "@/app/dashboard/schedule/actions";
import { Field } from "@/components/forms/field";
import { TimePicker } from "@/components/forms/time-picker";
import { WeekPreview } from "@/components/illustrations/previews";
import { ChoiceCard, Wizard, type WizardStep } from "@/components/wizard/wizard";
import { WEEKDAYS } from "@/lib/datetime";
import { buildSchedule, describeSchedule, scheduleStepIssues, type ScheduleWizardValues } from "@/lib/schedule-wizard";
import { cn } from "@/lib/utils";

const DAY_PRESETS = [
  { label: "Lunes a viernes", days: [1, 2, 3, 4, 5] },
  { label: "Lunes a sábado", days: [1, 2, 3, 4, 5, 6] },
  { label: "Todos los días", days: [1, 2, 3, 4, 5, 6, 7] },
];

/**
 * Weekly hours in four questions: which days, from what time to what time,
 * a lunch break, and days that are different. Saves through the same action
 * as the day-by-day editor.
 */
export function ScheduleWizard({
  staffId,
  initial,
  personName,
  doneHref,
}: {
  staffId: string;
  initial: ScheduleWizardValues;
  /** Team mode: whose schedule this is. */
  personName: string | null;
  doneHref: string;
}) {
  const router = useRouter();
  const whose = personName ? `de ${personName}` : "tuyo";

  const steps: WizardStep<ScheduleWizardValues>[] = [
    {
      id: "dias",
      label: "Días",
      title: personName ? `¿Qué días atiende ${personName}?` : "¿Qué días atendés?",
      why: "Tocá los días en que se pueden tomar turnos. Los demás quedan cerrados.",
      fields: ["days"],
      issues: (v) => scheduleStepIssues("dias", v),
      render: ({ values, set }) => (
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            {DAY_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => set({ days: preset.days })}
                className="rounded-full bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary-soft-foreground hover:bg-primary-soft/70"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7" role="group" aria-label="Días que atendés">
            {WEEKDAYS.map(({ value, label }) => {
              const on = values.days.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ days: on ? values.days.filter((d) => d !== value) : [...values.days, value].sort() })}
                  className={cn(
                    "h-14 rounded-2xl border-2 text-sm font-bold transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40",
                  )}
                >
                  {label.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      ),
    },
    {
      id: "horario",
      label: "Horario",
      title: "¿A qué hora abrís y a qué hora cerrás?",
      why: "El horario de un día normal. Si cerrás al mediodía, lo vemos en el próximo paso.",
      fields: ["open", "close"],
      issues: (v) => scheduleStepIssues("horario", v),
      render: ({ values, set }) => (
        <div className="flex flex-wrap gap-6">
          <Field id="open" label="Abro a las">
            <TimePicker id="open" aria-label="Abro a las" value={values.open} onChange={(open) => set({ open })} />
          </Field>
          <Field id="close" label="Cierro a las">
            <TimePicker id="close" aria-label="Cierro a las" value={values.close} onChange={(close) => set({ close })} />
          </Field>
        </div>
      ),
    },
    {
      id: "corte",
      label: "Corte",
      title: "¿Cerrás al mediodía?",
      why: "Si hacés un corte para almorzar, en ese rato no se van a ofrecer turnos.",
      fields: ["hasBreak", "breakStart", "breakEnd"],
      issues: (v) => scheduleStepIssues("corte", v),
      render: ({ values, set }) => (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Corte al mediodía">
            <ChoiceCard selected={!values.hasBreak} onSelect={() => set({ hasBreak: false })} icon={<SunIcon className="size-5" />} title="No, de corrido" text={`De ${values.open} a ${values.close}.`} />
            <ChoiceCard selected={values.hasBreak} onSelect={() => set({ hasBreak: true })} icon={<CoffeeIcon className="size-5" />} title="Sí, hago un corte" text="Elegís de qué hora a qué hora." />
          </div>
          {values.hasBreak && (
            <div className="flex flex-wrap gap-6">
              <Field id="breakStart" label="Corto a las">
                <TimePicker id="breakStart" aria-label="Corto a las" value={values.breakStart} onChange={(breakStart) => set({ breakStart })} />
              </Field>
              <Field id="breakEnd" label="Vuelvo a las">
                <TimePicker id="breakEnd" aria-label="Vuelvo a las" value={values.breakEnd} onChange={(breakEnd) => set({ breakEnd })} />
              </Field>
            </div>
          )}
        </div>
      ),
    },
    {
      id: "distinto",
      label: "Días distintos",
      title: "¿Algún día tenés otro horario?",
      why: "Por ejemplo, el sábado solo a la mañana. Si todos los días son iguales, seguí sin tocar nada.",
      fields: ["special"],
      issues: (v) => scheduleStepIssues("distinto", v),
      render: ({ values, set }) => (
        <ul className="flex flex-col divide-y rounded-2xl border">
          {values.days.map((weekday) => {
            const label = WEEKDAYS.find((d) => d.value === weekday)!.label;
            const special = values.special[weekday];
            return (
              <li key={weekday} className="flex flex-wrap items-center gap-3 p-3">
                <span className="w-24 font-semibold">{label}</span>
                {special ? (
                  <>
                    <TimePicker aria-label={`${label}: abro`} value={special.open} onChange={(open) => set({ special: { ...values.special, [weekday]: { ...special, open } } })} />
                    <span className="text-sm text-muted-foreground">a</span>
                    <TimePicker aria-label={`${label}: cierro`} value={special.close} onChange={(close) => set({ special: { ...values.special, [weekday]: { ...special, close } } })} />
                    <button
                      type="button"
                      onClick={() => {
                        const rest = { ...values.special };
                        delete rest[weekday];
                        set({ special: rest });
                      }}
                      className="text-sm font-semibold text-primary"
                    >
                      Igual a los demás
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-muted-foreground">Igual a los demás</span>
                    <button
                      type="button"
                      onClick={() => set({ special: { ...values.special, [weekday]: { open: values.open, close: values.breakStart } } })}
                      className="text-sm font-semibold text-primary"
                    >
                      Es distinto
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ),
    },
  ];

  function review(values: ScheduleWizardValues) {
    const days = buildSchedule(values);
    return (
      <div className="grid gap-4">
        <p className="rounded-2xl bg-primary-soft/60 p-4 text-[15px] font-semibold">{describeSchedule(days)}</p>
        <WeekPreview days={days} caption={`Así queda el horario ${whose}. Solo se ofrecen turnos dentro de estas barras.`} />
      </div>
    );
  }

  async function onSubmit(values: ScheduleWizardValues) {
    const data = new FormData();
    data.set("schedule", JSON.stringify(buildSchedule(values)));
    const result = await saveWeeklyScheduleAction(staffId, {}, data);
    if (!result.errors) router.push(doneHref);
    return result;
  }

  return <Wizard steps={steps} initial={initial} review={review} onSubmit={onSubmit} submitLabel="Guardar horario" cancelHref={doneHref} successMessage="Horario guardado" />;
}
