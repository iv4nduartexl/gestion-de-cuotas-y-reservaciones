"use client";

import { ReceiptTextIcon, RepeatIcon, UserPlusIcon, XIcon } from "lucide-react";

import { createChargeAction } from "@/app/dashboard/cuotas/actions";
import { ClientSearch, type ClientOption } from "@/components/clients/client-picker";
import { Field } from "@/components/forms/field";
import { CiInput, DatePicker, MoneyInput, PhoneInput } from "@/components/forms/py-inputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityAvatar } from "@/components/ui-kit/entity-avatar";
import { ChoiceCard, Wizard, type WizardStep } from "@/components/wizard/wizard";
import { addDays } from "@/lib/billing";
import type { Issue } from "@/lib/config-rules";
import { formatCalendarDate } from "@/lib/datetime";
import { formatAmountInput, formatMoney, parseMoneyInput } from "@/lib/money";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { enrollFormData, enrollInitial, EnrollReview, enrollSteps, type EnrollValues, type PlanOption } from "./enroll-wizard";

type Values = EnrollValues & {
  client: ClientOption | null;
  isNew: boolean;
  name: string;
  phone: string;
  email: string;
  documentNumber: string;
  what: "plan" | "one_off" | null;
  concept: string;
  amount: number | null;
  dueDate: string;
};

const CONCEPT_CHIPS = ["Matrícula", "Clase suelta", "Deuda anterior", "Inscripción"];
const date = (value: string) => formatCalendarDate(value, "dd/MM/yyyy");

/**
 * "Nuevo cobro": who (search, or someone new) → what (a plan, or something
 * charged once) → the details → review. Saved in one go on the server.
 */
export function ChargeWizard({
  plans,
  today,
  currency,
  currencyPrefix,
  clientNoun,
  initialClient,
}: {
  plans: PlanOption[];
  today: string;
  currency: string;
  currencyPrefix: string;
  clientNoun: string;
  /** Coming from a client page: skip the "¿A quién?" search. */
  initialClient: ClientOption | null;
}) {
  const nameOf = (v: Values) => (v.client ? v.client.name : v.name.trim()) || `tu ${clientNoun}`;
  const firstOf = (v: Values) => nameOf(v).split(" ")[0];

  const steps: WizardStep<Values>[] = [
    {
      id: "quien",
      label: "A quién",
      title: "¿A quién le cobrás?",
      why: `Buscalo por nombre, teléfono o C.I. Si es la primera vez que viene, tocá “Es alguien nuevo”.`,
      fields: ["clientId"],
      issues: (v) => (v.client || v.isNew ? [] : [{ field: "client", message: `Elegí a un ${clientNoun} o tocá “Es alguien nuevo”.`, fixes: [] }]),
      render: ({ values, set }) =>
        values.client ? (
          <div className="flex items-center gap-3 rounded-2xl border-2 border-primary bg-primary-soft/40 p-4">
            <EntityAvatar name={values.client.name} />
            <span className="flex flex-1 flex-col">
              <span className="font-bold">{values.client.name}</span>
              <span className="text-sm text-muted-foreground tabular">{formatPhone(values.client.phone)}</span>
            </span>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Elegir a otra persona" onClick={() => set({ client: null })}>
              <XIcon />
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            <ClientSearch clientNoun={clientNoun} onPick={(client) => set({ client, isNew: false })} />
            <ChoiceCard
              selected={values.isNew}
              onSelect={() => set({ isNew: true, client: null })}
              icon={<UserPlusIcon className="size-5" />}
              title="Es alguien nuevo"
              text="Lo cargamos en el paso siguiente."
            />
          </div>
        ),
    },
    {
      id: "nombre",
      label: "Sus datos",
      title: "¿Cómo se llama y cuál es su teléfono?",
      why: "Con el teléfono le podés mandar el recordatorio de pago por WhatsApp.",
      skip: (v) => !v.isNew || !!v.client,
      fields: ["name", "phone"],
      issues: (v) => {
        const issues: Issue<Values>[] = [];
        if (v.name.trim().length < 2) issues.push({ field: "name", message: "Escribí su nombre y apellido.", fixes: [] });
        if (!normalizePhone(v.phone)) issues.push({ field: "phone", message: "Escribí un teléfono válido, por ejemplo 0981 123 456.", fixes: [] });
        return issues;
      },
      render: ({ values, set, errors }) => (
        <div className="grid gap-4">
          <Field id="name" label="Nombre y apellido" error={errors.name}>
            <Input id="name" value={values.name} onChange={(event) => set({ name: event.target.value })} autoComplete="off" />
          </Field>
          <Field id="phone" label="Teléfono / WhatsApp" error={errors.phone}>
            <PhoneInput id="phone" defaultValue={values.phone} onValueChange={(phone) => set({ phone })} invalid={!!errors.phone} />
          </Field>
        </div>
      ),
    },
    {
      id: "extra",
      label: "Más datos",
      title: "¿Querés agregar su correo o su C.I.?",
      why: "No hace falta: podés dejarlo vacío y completarlo después desde su ficha.",
      skip: (v) => !v.isNew || !!v.client,
      fields: ["email", "documentNumber"],
      render: ({ values, set, errors }) => (
        <div className="grid gap-4">
          <Field id="email" label="Correo" optional error={errors.email}>
            <Input id="email" type="email" value={values.email} onChange={(event) => set({ email: event.target.value })} autoComplete="off" />
          </Field>
          <Field id="documentNumber" label="C.I." optional error={errors.documentNumber}>
            <CiInput id="documentNumber" defaultValue={values.documentNumber} onValueChange={(documentNumber) => set({ documentNumber })} />
          </Field>
        </div>
      ),
    },
    {
      id: "que",
      label: "Qué",
      title: (v) => `¿Qué le cobrás a ${firstOf(v)}?`,
      why: "Un plan se cobra solo cada período. Un cobro único es una sola vez: una matrícula, una deuda vieja, una clase suelta.",
      fields: ["what"],
      issues: (v) => (v.what ? [] : [{ field: "what", message: "Elegí una de las dos opciones.", fixes: [] }]),
      render: ({ values, set }) => (
        <div className="grid gap-3" role="radiogroup" aria-label="Qué le cobrás">
          {plans.length > 0 ? (
            <ChoiceCard
              selected={values.what === "plan"}
              onSelect={() => set({ what: "plan" })}
              icon={<RepeatIcon className="size-5" />}
              title="Una cuota de un plan"
              text="Lo inscribís y las cuotas se arman solas."
            />
          ) : (
            <p className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
              Todavía no tenés planes. Para cobrar cuotas cada mes, primero creá un plan desde “Mi negocio”.
            </p>
          )}
          <ChoiceCard
            selected={values.what === "one_off"}
            onSelect={() => set({ what: "one_off" })}
            icon={<ReceiptTextIcon className="size-5" />}
            title="Un cobro único"
            text="Se cobra una sola vez."
          />
        </div>
      ),
    },
    ...enrollSteps<Values>({ plans, today, currencyPrefix, first: firstOf, skip: (v) => v.what !== "plan" }),
    {
      id: "concepto",
      label: "Concepto",
      title: "¿Por qué concepto?",
      why: "Es lo que va a ver en la lista de cuotas y en el recordatorio. Tocá una opción o escribí la tuya.",
      skip: (v) => v.what !== "one_off",
      fields: ["concept"],
      issues: (v) => (v.concept.trim().length < 2 ? [{ field: "concept", message: "Escribí qué le cobrás.", fixes: [] }] : []),
      render: ({ values, set }) => (
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Conceptos comunes">
            {CONCEPT_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                role="radio"
                aria-checked={values.concept === chip}
                onClick={() => set({ concept: chip })}
                className={cn(
                  "h-11 rounded-full border-2 px-4 text-sm font-bold",
                  values.concept === chip ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40",
                )}
              >
                {chip}
              </button>
            ))}
          </div>
          <Field id="concept" label="Concepto">
            <Input id="concept" value={values.concept} maxLength={100} onChange={(event) => set({ concept: event.target.value })} autoComplete="off" />
          </Field>
        </div>
      ),
    },
    {
      id: "monto",
      label: "Monto",
      title: "¿Cuánto le cobrás?",
      why: "El total a pagar. Si paga en partes, después registrás cada pago.",
      skip: (v) => v.what !== "one_off",
      fields: ["amount"],
      issues: (v) => (v.amount && v.amount > 0 ? [] : [{ field: "amount", message: "Escribí el monto.", fixes: [] }]),
      render: ({ values, set }) => (
        <Field id="amount" label="Monto">
          <MoneyInput
            id="amount"
            prefix={currencyPrefix}
            defaultValue={values.amount === null ? "" : formatAmountInput(values.amount, currency)}
            onValueChange={(text) => set({ amount: text ? parseMoneyInput(text, currency) : null })}
          />
        </Field>
      ),
    },
    {
      id: "vence",
      label: "Vence",
      title: "¿Hasta cuándo tiene para pagar?",
      why: "Pasada esta fecha (y la tolerancia de tu negocio) figura como vencido.",
      skip: (v) => v.what !== "one_off",
      fields: ["dueDate"],
      render: ({ values, set }) => (
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Plazos comunes">
            {[
              { label: "Hoy", days: 0 },
              { label: "En 7 días", days: 7 },
              { label: "En 15 días", days: 15 },
              { label: "En 30 días", days: 30 },
            ].map(({ label, days }) => {
              const due = addDays(today, days);
              return (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={values.dueDate === due}
                  onClick={() => set({ dueDate: due })}
                  className={cn(
                    "h-11 rounded-full border-2 px-4 text-sm font-bold",
                    values.dueDate === due ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <Field id="dueDate" label="Vence el">
            <DatePicker id="dueDate" name="dueDate" value={values.dueDate} onChange={(dueDate) => set({ dueDate })} />
          </Field>
        </div>
      ),
    },
  ];

  function review(values: Values) {
    const who = (
      <div className="flex items-center gap-3 rounded-2xl border-2 bg-background p-4">
        <EntityAvatar name={nameOf(values)} />
        <span className="flex flex-col">
          <span className="font-bold">
            {nameOf(values)}
            {!values.client && <span className="ml-2 text-xs font-semibold text-primary">Nuevo</span>}
          </span>
          <span className="text-sm text-muted-foreground tabular">
            {values.client ? formatPhone(values.client.phone) : values.phone}
          </span>
        </span>
      </div>
    );
    if (values.what === "plan") {
      return (
        <div className="grid gap-3">
          {who}
          <EnrollReview plans={plans} values={values} clientName={nameOf(values)} />
        </div>
      );
    }
    return (
      <div className="grid gap-3">
        {who}
        <div className="rounded-2xl border-2 bg-background p-4">
          <p className="font-bold">
            {values.concept} · {formatMoney(values.amount ?? 0, currency)}
          </p>
          <p className="text-sm text-muted-foreground">Cobro único · vence el {date(values.dueDate)}</p>
        </div>
      </div>
    );
  }

  async function onSubmit(values: Values) {
    const data = values.what === "plan" ? enrollFormData(plans, values) : new FormData();
    data.set("clientId", values.client?.id ?? "");
    data.set("name", values.name);
    data.set("phone", values.phone);
    data.set("email", values.email);
    data.set("documentNumber", values.documentNumber);
    data.set("what", values.what ?? "");
    if (values.what === "one_off") {
      data.set("concept", values.concept);
      data.set("amount", values.amount === null ? "" : formatAmountInput(values.amount, currency));
      data.set("dueDate", values.dueDate);
      data.set("note", "");
    }
    // Success redirects to the client's page.
    return createChargeAction({}, data);
  }

  return (
    <Wizard
      steps={steps}
      initial={{
        ...enrollInitial(plans, today),
        client: initialClient,
        isNew: false,
        name: "",
        phone: "",
        email: "",
        documentNumber: "",
        what: plans.length === 0 ? "one_off" : null,
        concept: "",
        amount: null,
        dueDate: today,
      }}
      review={review}
      onSubmit={onSubmit}
      submitLabel="Crear cobro"
      cancelHref={initialClient ? `/dashboard/clients/${initialClient.id}` : "/dashboard/cuotas"}
    />
  );
}
