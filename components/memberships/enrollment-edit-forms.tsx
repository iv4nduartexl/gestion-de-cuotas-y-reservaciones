"use client";

import { CalendarCheckIcon, CalendarClockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { changePlanAction } from "@/app/dashboard/cuotas/actions";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { DatePicker, MoneyInput } from "@/components/forms/py-inputs";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui-kit/section-card";
import { IssueBox } from "@/components/wizard/issue-box";
import { ChoiceCard, Wizard } from "@/components/wizard/wizard";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionState } from "@/lib/actions";
import { reanchorIssues } from "@/lib/config-rules";
import { formatCalendarDate } from "@/lib/datetime";
import type { BillingTiming } from "@/lib/membership-constants";
import { formatAmountInput, formatMoney } from "@/lib/money";
import { enrollFormData, enrollInitial, EnrollReview, enrollSteps, type EnrollValues, type PlanOption } from "./enroll-wizard";

type BoundAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
const date = (value: string) => formatCalendarDate(value, "dd/MM/yyyy");

function SaveBar({ pending, disabled = false }: { pending: boolean; disabled?: boolean }) {
  return (
    <div className="sticky bottom-24 z-10 flex justify-end md:bottom-6">
      <Button type="submit" size="lg" disabled={pending || disabled} className="shadow-lift">
        {pending ? "Guardando…" : "Guardar cambio"}
      </Button>
    </div>
  );
}

/** "Precio desde ahora". */
export function EnrollmentPriceForm({ action, price, currency, currencyPrefix }: { action: BoundAction; price: number; currency: string; currencyPrefix: string }) {
  const { state, pending, formProps } = useFormAction(action, {});
  const errors = state.errors ?? {};
  return (
    <form {...formProps} noValidate className="flex max-w-xl flex-col gap-6">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <SectionCard
        title="¿Cuánto paga desde ahora?"
        description={`Ahora paga ${formatMoney(price, currency)}. Cambian las cuotas que vencen desde hoy y todavía no tienen pagos; las anteriores quedan como están.`}
      >
        <Field id="price" label="Nuevo precio" error={errors.price}>
          <MoneyInput id="price" name="price" prefix={currencyPrefix} defaultValue={formatAmountInput(price, currency)} invalid={!!errors.price} />
        </Field>
      </SectionCard>
      <SaveBar pending={pending} />
    </form>
  );
}

/** "Día de cobro": periods start on a new day, after the current one ends. */
export function BillingDayForm({ action, today, billedUntil }: { action: BoundAction; today: string; billedUntil: string }) {
  const { state, pending, formProps } = useFormAction(action, {});
  const errors = state.errors ?? {};
  const [newStart, setNewStart] = useState(billedUntil);
  const [revision, setRevision] = useState(0);
  const issues = reanchorIssues({ newStart }, { today, billedUntil });
  return (
    <form {...formProps} noValidate className="flex max-w-xl flex-col gap-6">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <SectionCard
        title="¿Desde qué día le cobrás?"
        description={`La cuota actual cubre hasta el ${date(billedUntil)}. Elegí el día en que empieza el nuevo período: desde ahí, cada cuota vence ese día.`}
      >
        <Field id="newStart" label="Nuevo día de cobro" error={errors.newStart}>
          <DatePicker key={revision} id="newStart" name="newStart" value={newStart} min={today} onChange={setNewStart} />
        </Field>
        {newStart > billedUntil && issues.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Entre el {date(billedUntil)} y el {date(newStart)} no se cobra nada.
          </p>
        )}
        <IssueBox
          issues={issues}
          onFix={(fix) => {
            if (fix.patch.newStart) setNewStart(fix.patch.newStart);
            setRevision((n) => n + 1);
          }}
        />
      </SectionCard>
      <SaveBar pending={pending} disabled={issues.length > 0} />
    </form>
  );
}

/** "Cuándo paga" from now on. */
export function BillingTimingForm({ action, timing }: { action: BoundAction; timing: BillingTiming }) {
  const { state, pending, formProps } = useFormAction(action, {});
  const errors = state.errors ?? {};
  const [value, setValue] = useState<BillingTiming>(timing);
  return (
    <form {...formProps} noValidate className="flex max-w-xl flex-col gap-6">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <input type="hidden" name="billingTiming" value={value} />
      <SectionCard title="¿Cuándo paga cada cuota?" description="Vale para los próximos períodos. Lo que ya se generó no cambia.">
        <div className="grid gap-3" role="radiogroup" aria-label="Cuándo paga">
          <ChoiceCard selected={value === "advance"} onSelect={() => setValue("advance")} icon={<CalendarCheckIcon className="size-5" />} title="Por adelantado" text="Al empezar cada período." />
          <ChoiceCard selected={value === "arrears"} onSelect={() => setValue("arrears")} icon={<CalendarClockIcon className="size-5" />} title="A período vencido" text="Al terminar cada período: primero usa, después paga." />
        </div>
      </SectionCard>
      <SaveBar pending={pending} disabled={value === timing} />
    </form>
  );
}

/** "Cambiar de plan": the enroll questions, starting when the current period ends. */
export function ChangePlanWizard({
  enrollmentId,
  clientId,
  clientName,
  plans,
  today,
  suggestedStart,
  currencyPrefix,
}: {
  enrollmentId: string;
  clientId: string;
  clientName: string;
  plans: PlanOption[];
  today: string;
  /** When the current period ends: the natural day to switch. */
  suggestedStart: string;
  currencyPrefix: string;
}) {
  const router = useRouter();
  const first = clientName.split(" ")[0];
  const steps = enrollSteps<EnrollValues>({ plans, today, currencyPrefix, first: () => first }).map((step) =>
    step.id === "plan"
      ? { ...step, title: `¿A qué plan pasa ${first}?`, why: "Su plan actual termina el día del cambio y empieza el nuevo, sin perder su antigüedad." }
      : step.id === "desde"
        ? {
            ...step,
            title: "¿Desde qué día cambia?",
            why: `Lo más común es al terminar el período actual (${date(suggestedStart)}), así no paga dos veces los mismos días.`,
            issues: (v: EnrollValues) =>
              v.startDate < today
                ? [{ field: "startDate" as const, message: "El cambio tiene que ser desde hoy o más adelante.", fixes: [{ label: `Desde el ${date(suggestedStart)}`, patch: { startDate: suggestedStart, firstDueDate: suggestedStart } }] }]
                : [],
          }
        : step,
  );

  async function onSubmit(values: EnrollValues) {
    const result = await changePlanAction(enrollmentId, {}, enrollFormData(plans, values));
    if (!result?.errors) router.push(`/dashboard/clients/${clientId}`);
    return result;
  }

  return (
    <Wizard
      steps={steps}
      initial={{ ...enrollInitial(plans, today), startDate: suggestedStart, firstDueDate: suggestedStart }}
      review={(values) => <EnrollReview plans={plans} values={values} clientName={clientName} />}
      onSubmit={onSubmit}
      submitLabel="Cambiar de plan"
      cancelHref={`/dashboard/clients/${clientId}`}
    />
  );
}
