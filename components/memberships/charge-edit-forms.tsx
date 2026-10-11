"use client";

import { CheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { splitChargeAction } from "@/app/dashboard/cuotas/actions";
import { Field } from "@/components/forms/field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { DatePicker, MoneyInput } from "@/components/forms/py-inputs";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui-kit/section-card";
import { IssueBox } from "@/components/wizard/issue-box";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionState } from "@/lib/actions";
import { addDays, addInterval } from "@/lib/billing";
import {
  applyFix,
  chargeAmountIssues,
  equalParts,
  MAX_SPLIT_PARTS,
  splitIssues,
  type SplitValues,
} from "@/lib/config-rules";
import { formatCalendarDate } from "@/lib/datetime";
import { MANUAL_PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/membership-constants";
import { formatAmountInput, formatMoney, parseMoneyInput } from "@/lib/money";
import { cn } from "@/lib/utils";

type BoundAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
const date = (value: string) => formatCalendarDate(value, "dd/MM/yyyy");

function SaveBar({ pending, disabled = false, label = "Guardar cambio" }: { pending: boolean; disabled?: boolean; label?: string }) {
  return (
    <div className="sticky bottom-24 z-10 flex justify-end md:bottom-6">
      <Button type="submit" size="lg" disabled={pending || disabled} className="shadow-lift">
        {pending ? "Guardando…" : label}
      </Button>
    </div>
  );
}

function Chips<T extends string | number>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-11 rounded-full border-2 px-4 text-sm font-bold",
            option.value === value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** "Darle más tiempo": +7 / +15 / +30 days from the current due date, or any date. */
export function MoveDueForm({ action, dueDate, today }: { action: BoundAction; dueDate: string; today: string }) {
  const { state, pending, formProps } = useFormAction(action, {});
  const errors = state.errors ?? {};
  // An overdue cuota gets the extra days from today, not from the old date.
  const base = dueDate < today ? today : dueDate;
  const [value, setValue] = useState(addDays(base, 7));
  return (
    <form {...formProps} noValidate className="flex max-w-xl flex-col gap-6">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <SectionCard title="¿Hasta cuándo le das?" description={`Ahora vence el ${date(dueDate)}. Con la nueva fecha deja de figurar como vencida hasta ese día, y los recordatorios se reprograman.`}>
        <Chips
          label="Más tiempo"
          value={value}
          onChange={setValue}
          options={[7, 15, 30].map((days) => ({ value: addDays(base, days), label: `+${days} días` }))}
        />
        <Field id="dueDate" label="Nueva fecha" error={errors.dueDate}>
          <DatePicker id="dueDate" name="dueDate" value={value} onChange={setValue} />
        </Field>
      </SectionCard>
      <SaveBar pending={pending} />
    </form>
  );
}

/** A new total for the cuota, never below what's already paid. */
export function ChangeAmountForm({ action, amount, paid, currency, currencyPrefix }: { action: BoundAction; amount: number; paid: number; currency: string; currencyPrefix: string }) {
  const { state, pending, formProps } = useFormAction(action, {});
  const errors = state.errors ?? {};
  const [value, setValue] = useState<number | null>(amount);
  const [revision, setRevision] = useState(0);
  const issues = chargeAmountIssues({ amount: value }, { paid, currency });
  return (
    <form {...formProps} noValidate className="flex max-w-xl flex-col gap-6">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <SectionCard
        title="¿Cuánto tiene que pagar en total?"
        description={`Ahora son ${formatMoney(amount, currency)}${paid > 0 ? ` y ya pagó ${formatMoney(paid, currency)}` : ""}. Bajalo para un descuento o subilo para un recargo.`}
      >
        <Field id="amount" label="Nuevo monto" error={errors.amount}>
          <MoneyInput
            key={revision}
            id="amount"
            name="amount"
            prefix={currencyPrefix}
            defaultValue={value === null ? "" : formatAmountInput(value, currency)}
            onValueChange={(text) => setValue(text ? parseMoneyInput(text, currency) : null)}
          />
        </Field>
        <IssueBox
          issues={issues}
          onFix={(fix) => {
            setValue(applyFix({ amount: value }, fix).amount);
            setRevision((n) => n + 1);
          }}
        />
      </SectionCard>
      <SaveBar pending={pending} disabled={issues.length > 0 || value === amount} />
    </form>
  );
}

/** "Dividir en partes": 2–4 parts that add up to what's left, each with its own due date. */
export function SplitForm({
  chargeId,
  remaining,
  dueDate,
  today,
  currency,
  currencyPrefix,
}: {
  chargeId: string;
  remaining: number;
  dueDate: string;
  today: string;
  currency: string;
  currencyPrefix: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const first = dueDate < today ? today : dueDate;
  const build = (count: number): SplitValues => {
    const amounts = equalParts(remaining, count);
    return { parts: amounts.map((amount, i) => ({ amount, dueDate: addInterval(first, "month", i) })) };
  };
  const [values, setValues] = useState<SplitValues>(() => build(2));
  const [revision, setRevision] = useState(0);
  const issues = splitIssues(values, { remaining, currency });
  const sum = values.parts.reduce((total, part) => total + (part.amount ?? 0), 0);

  function setPart(index: number, patch: Partial<SplitValues["parts"][number]>) {
    setValues((current) => ({ parts: current.parts.map((part, i) => (i === index ? { ...part, ...patch } : part)) }));
  }

  function submit() {
    startTransition(async () => {
      const result = await splitChargeAction(chargeId, values.parts);
      if (result?.errors) setError(result.errors.parts ?? result.errors.form ?? "No se pudo dividir.");
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {error && <FormMessage type="error">{error}</FormMessage>}
      <SectionCard title="¿En cuántas partes?" description={`Falta pagar ${formatMoney(remaining, currency)}. Lo repartimos en partes iguales, una por mes; cambiá montos y fechas si querés.`}>
        <Chips
          label="Cantidad de partes"
          value={values.parts.length}
          onChange={(count) => {
            setValues(build(count));
            setRevision((n) => n + 1);
          }}
          options={Array.from({ length: MAX_SPLIT_PARTS - 1 }, (_, i) => ({ value: i + 2, label: `${i + 2} partes` }))}
        />
      </SectionCard>
      <SectionCard title="Las partes" description="La primera queda en esta cuota; las demás aparecen como cuotas nuevas en la lista.">
        <ol className="flex flex-col gap-4">
          {values.parts.map((part, index) => (
            <li key={`${revision}-${index}`} className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-[auto_1fr_1fr] sm:items-end">
              <span className="font-bold">Parte {index + 1}</span>
              <Field id={`part-amount-${index}`} label={`Monto de la parte ${index + 1}`}>
                <MoneyInput
                  id={`part-amount-${index}`}
                  prefix={currencyPrefix}
                  defaultValue={part.amount === null ? "" : formatAmountInput(part.amount, currency)}
                  onValueChange={(text) => setPart(index, { amount: text ? parseMoneyInput(text, currency) : null })}
                />
              </Field>
              <Field id={`part-due-${index}`} label={`Vence la parte ${index + 1}`}>
                <DatePicker id={`part-due-${index}`} name={`part-due-${index}`} value={part.dueDate} onChange={(value) => setPart(index, { dueDate: value })} />
              </Field>
            </li>
          ))}
        </ol>
        <p className="flex items-center gap-2 text-sm text-muted-foreground tabular">
          {sum === remaining && <CheckIcon className="size-4 text-success" aria-hidden="true" />}
          Suman {formatMoney(sum, currency)} de {formatMoney(remaining, currency)}
        </p>
        <IssueBox
          issues={issues}
          onFix={(fix) => {
            setValues((current) => applyFix(current, fix));
            setRevision((n) => n + 1);
          }}
        />
      </SectionCard>
      <div className="sticky bottom-24 z-10 flex justify-between gap-3 md:bottom-6">
        <Button type="button" variant="ghost" size="lg" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="button" size="lg" className="shadow-lift" disabled={pending || issues.length > 0} onClick={submit}>
          {pending ? "Guardando…" : `Dividir en ${values.parts.length} partes`}
        </Button>
      </div>
    </div>
  );
}

/** Corrects a payment recorded by hand. */
export function EditPaymentForm({
  action,
  payment,
  currency,
  currencyPrefix,
}: {
  action: BoundAction;
  payment: { amount: number; method: PaymentMethod; paidOn: string; reference: string | null };
  currency: string;
  currencyPrefix: string;
}) {
  const { state, pending, formProps } = useFormAction(action, {});
  const errors = state.errors ?? {};
  const [method, setMethod] = useState<PaymentMethod>(payment.method);
  const [paidOn, setPaidOn] = useState(payment.paidOn);
  return (
    <form {...formProps} noValidate className="flex max-w-xl flex-col gap-6">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <SectionCard title="Corregir el pago" description="Si lo cargaste mal (monto, forma de pago o fecha). La cuota se actualiza sola.">
        <Field id="amount" label="Monto recibido" error={errors.amount}>
          <MoneyInput id="amount" name="amount" prefix={currencyPrefix} defaultValue={formatAmountInput(payment.amount, currency)} invalid={!!errors.amount} />
        </Field>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">Cómo pagó</legend>
          <input type="hidden" name="method" value={method} />
          <Chips
            label="Cómo pagó"
            value={method}
            onChange={setMethod}
            options={MANUAL_PAYMENT_METHODS.map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value].split(" (")[0] }))}
          />
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="paidOn" label="Fecha" error={errors.paidOn}>
            <DatePicker id="paidOn" name="paidOn" value={paidOn} onChange={setPaidOn} />
          </Field>
          <FormField name="reference" label="Comprobante" optional defaultValue={payment.reference ?? ""} error={errors.reference} />
        </div>
      </SectionCard>
      <SaveBar pending={pending} />
    </form>
  );
}
