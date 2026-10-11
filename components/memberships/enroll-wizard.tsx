"use client";

import { CalendarCheckIcon, CalendarClockIcon, CalendarDaysIcon, GiftIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { enrollAction } from "@/app/dashboard/cuotas/actions";
import { Field } from "@/components/forms/field";
import { DatePicker, MoneyInput } from "@/components/forms/py-inputs";
import { ChoiceCard, Wizard, type WizardStep } from "@/components/wizard/wizard";
import { periodsFor, periodStart } from "@/lib/billing";
import { formatCalendarDate } from "@/lib/datetime";
import { intervalLabel, type BillingTiming, type IntervalUnit } from "@/lib/membership-constants";
import { formatAmountInput, formatMoney, parseMoneyInput } from "@/lib/money";
import type { FirstCuotaChoice } from "@/lib/validation/memberships";

export type PlanOption = {
  id: string;
  name: string;
  price: number;
  currency: string;
  intervalUnit: IntervalUnit;
  intervalCount: number;
  billingTiming: BillingTiming;
};

export type EnrollValues = {
  planId: string;
  price: number | null;
  startDate: string;
  firstCuota: FirstCuotaChoice | null;
  firstDueDate: string;
};
type Values = EnrollValues;

const date = (value: string) => formatCalendarDate(value, "dd/MM/yyyy");

/** Due dates of the first cuotas for the chosen option. */
function firstDues(plan: PlanOption, values: Values, choice: FirstCuotaChoice, count = 2) {
  return periodsFor({
    startDate: values.startDate,
    billFrom: choice === "free" ? periodStart(values.startDate, plan.intervalUnit, plan.intervalCount, 1) : values.startDate,
    unit: plan.intervalUnit,
    count: plan.intervalCount,
    until: periodStart(values.startDate, plan.intervalUnit, plan.intervalCount, count + 2),
    timing: choice === "end" ? "arrears" : choice === "date" ? plan.billingTiming : "advance",
    firstDueDate: choice === "date" ? values.firstDueDate : null,
  })
    .slice(0, count)
    .map((period) => period.dueDate);
}

export const enrollInitial = (plans: PlanOption[], today: string): EnrollValues => ({
  planId: plans[0]?.id ?? "",
  price: null,
  startDate: today,
  firstCuota: null,
  firstDueDate: today,
});

const planOf = (plans: PlanOption[], v: EnrollValues) => plans.find((p) => p.id === v.planId) ?? plans[0];
const choiceOf = (plans: PlanOption[], v: EnrollValues): FirstCuotaChoice =>
  v.firstCuota ?? (planOf(plans, v).billingTiming === "arrears" ? "end" : "start");

/**
 * The enroll questions (plan → desde → primera cuota), shared by "Inscribir
 * en un plan" and "Nuevo cobro". `skip` hides them all (e.g. a one-off charge).
 */
export function enrollSteps<V extends EnrollValues>({
  plans,
  today,
  currencyPrefix,
  first,
  skip,
}: {
  plans: PlanOption[];
  today: string;
  currencyPrefix: string;
  /** First name, for "¿En qué plan anotás a …?". */
  first: (values: V) => string;
  skip?: (values: V) => boolean;
}): WizardStep<V>[] {
  const planOf_ = (v: EnrollValues) => planOf(plans, v);
  const choiceOf_ = (v: EnrollValues) => choiceOf(plans, v);
  const steps: WizardStep<EnrollValues>[] = [
    {
      id: "plan",
      label: "Plan",
      title: (v) => `¿En qué plan anotás a ${first(v as V)}?`,
      why: "Desde la inscripción, Agenda arma sus cuotas sola según el plan.",
      fields: ["planId", "price"],
      render: ({ values, set }) => {
        const plan = planOf_(values);
        return (
          <div className="grid gap-4">
            <div className="grid gap-3" role="radiogroup" aria-label="Plan">
              {plans.map((p) => (
                <ChoiceCard
                  key={p.id}
                  selected={p.id === plan.id}
                  onSelect={() => set({ planId: p.id })}
                  title={p.name}
                  text={`${formatMoney(p.price, p.currency)} ${intervalLabel(p.intervalUnit, p.intervalCount)}`}
                />
              ))}
            </div>
            <Field id="price" label="Precio especial" optional hint={`Dejalo vacío para cobrar ${formatMoney(plan.price, plan.currency)}.`}>
              <MoneyInput
                id="price"
                prefix={currencyPrefix}
                defaultValue={values.price === null ? "" : formatAmountInput(values.price, plan.currency)}
                onValueChange={(text) => set({ price: text ? parseMoneyInput(text, plan.currency) : null })}
              />
            </Field>
          </div>
        );
      },
    },
    {
      id: "desde",
      label: "Desde cuándo",
      title: "¿Desde qué día es socio?",
      why: "Los períodos se cuentan desde este día. Si elegís una fecha pasada, se generan las cuotas de esos períodos.",
      fields: ["startDate"],
      render: ({ values, set }) => (
        <div className="grid gap-3">
          <Field id="startDate" label="Desde">
            <DatePicker id="startDate" name="startDate" value={values.startDate} onChange={(startDate) => set({ startDate, firstDueDate: startDate })} />
          </Field>
          {values.startDate < today && (
            <p className="text-sm text-warning-foreground">La fecha es anterior a hoy: se van a generar las cuotas de los períodos que ya pasaron.</p>
          )}
        </div>
      ),
    },
    {
      id: "primera",
      label: "Primera cuota",
      title: "¿Cuándo paga la primera cuota?",
      why: "Muchos negocios cobran al empezar; otros, al terminar el mes. Elegí lo que hacés vos.",
      fields: ["firstCuota", "firstDueDate"],
      issues: (v) =>
        choiceOf_(v) === "date" && v.firstDueDate < v.startDate
          ? [{ field: "firstDueDate", message: "La primera cuota no puede ser antes del día en que empieza.", fixes: [{ label: "El día que empieza", patch: { firstDueDate: v.startDate } }] }]
          : [],
      render: ({ values, set }) => {
        const plan = planOf_(values);
        const choice = choiceOf_(values);
        const periodEnd = periodStart(values.startDate, plan.intervalUnit, plan.intervalCount, 1);
        return (
          <div className="grid gap-3" role="radiogroup" aria-label="Primera cuota">
            <ChoiceCard selected={choice === "start"} onSelect={() => set({ firstCuota: "start" })} icon={<CalendarCheckIcon className="size-5" />} title={`Al empezar (${date(values.startDate)})`} text="Paga por adelantado, al inicio de cada período." />
            <ChoiceCard selected={choice === "end"} onSelect={() => set({ firstCuota: "end" })} icon={<CalendarClockIcon className="size-5" />} title={`Al terminar el primer período (${date(periodEnd)})`} text="Primero usa, después paga." />
            <ChoiceCard selected={choice === "date"} onSelect={() => set({ firstCuota: "date" })} icon={<CalendarDaysIcon className="size-5" />} title="En otra fecha…" text="Por ejemplo, el día que cobra el sueldo." />
            {choice === "date" && (
              <Field id="firstDueDate" label="Fecha de la primera cuota">
                <DatePicker id="firstDueDate" name="firstDueDate" value={values.firstDueDate} min={values.startDate} onChange={(firstDueDate) => set({ firstDueDate })} />
              </Field>
            )}
            <ChoiceCard selected={choice === "free"} onSelect={() => set({ firstCuota: "free" })} icon={<GiftIcon className="size-5" />} title="Primer período sin cargo" text={`Empieza a pagar el ${date(periodEnd)}.`} />
          </div>
        );
      },
    },
  ];

  // The steps only touch EnrollValues fields, so they fit any V that extends it.
  return steps.map((step) => ({ ...step, skip })) as unknown as WizardStep<V>[];
}

/** "Revisar" for an enrollment. */
export function EnrollReview({ plans, values, clientName }: { plans: PlanOption[]; values: EnrollValues; clientName: string }) {
  const plan = planOf(plans, values);
  const dues = firstDues(plan, values, choiceOf(plans, values));
  return (
    <div className="grid gap-3">
      <div className="rounded-2xl border-2 bg-background p-4">
        <p className="font-bold">
          {clientName} · {plan.name}
        </p>
        <p className="text-sm text-muted-foreground">
          {formatMoney(values.price ?? plan.price, plan.currency)} {intervalLabel(plan.intervalUnit, plan.intervalCount)} · desde el {date(values.startDate)}
        </p>
      </div>
      <p className="rounded-2xl bg-muted/60 p-4 text-sm">
        {dues.map((due, index) => (
          <span key={due}>
            {index > 0 && " · "}
            {index + 1}ª cuota: <strong className="tabular">{date(due)}</strong>
          </span>
        ))}
      </p>
    </div>
  );
}

/** Form fields that enrollAction / createChargeAction read. */
export function enrollFormData(plans: PlanOption[], values: EnrollValues, data = new FormData()) {
  const plan = planOf(plans, values);
  data.set("planId", plan.id);
  data.set("startDate", values.startDate);
  data.set("price", values.price === null ? "" : formatAmountInput(values.price, plan.currency));
  data.set("notes", "");
  data.set("firstCuota", choiceOf(plans, values));
  data.set("firstDueDate", choiceOf(plans, values) === "date" ? values.firstDueDate : "");
  return data;
}

/** Enrolling a client in a plan, one question at a time. */
export function EnrollWizard({
  clientId,
  clientName,
  plans,
  today,
  currencyPrefix,
}: {
  clientId: string;
  clientName: string;
  plans: PlanOption[];
  today: string;
  currencyPrefix: string;
}) {
  const router = useRouter();
  const first = clientName.split(" ")[0];
  const steps = enrollSteps<EnrollValues>({ plans, today, currencyPrefix, first: () => first });

  async function onSubmit(values: EnrollValues) {
    const result = await enrollAction(clientId, {}, enrollFormData(plans, values));
    if (!result.errors) router.push(`/dashboard/clients/${clientId}`);
    return result;
  }

  return (
    <Wizard
      steps={steps}
      initial={enrollInitial(plans, today)}
      review={(values) => <EnrollReview plans={plans} values={values} clientName={clientName} />}
      onSubmit={onSubmit}
      submitLabel="Inscribir"
      cancelHref={`/dashboard/clients/${clientId}`}
    />
  );
}
