"use client";

import { BedDoubleIcon, CalendarClockIcon, ClockIcon, MoonIcon, SunIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createServiceAction, updateServiceAction } from "@/app/dashboard/services/actions";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/py-inputs";
import { TimePicker } from "@/components/forms/time-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EntityAvatar } from "@/components/ui-kit/entity-avatar";
import { ChoiceCard, Wizard, type WizardStep } from "@/components/wizard/wizard";
import { slotServiceIssues, stayIssues, type Issue } from "@/lib/config-rules";
import { formatDuration } from "@/lib/datetime";
import { formatAmountInput, formatMoney, parseMoneyInput } from "@/lib/money";
import { STAY_UNIT_WORDS, stayAmount } from "@/lib/service-constants";
import { stayPrice } from "@/lib/stays";
import { cn } from "@/lib/utils";
import { SERVICE_DURATION_CHIPS } from "@/lib/validation/services";
import type { ServiceWizardValues } from "@/lib/wizard-values";

export type { ServiceWizardValues };

type Props = {
  initial: ServiceWizardValues;
  /** Editing an existing service: its id and the single step to change. */
  edit?: { id: string; step: string };
  staffOptions: { id: string; name: string; hasHours: boolean }[];
  showStaff: boolean;
  longestByStaff: Record<string, number>;
  currency: string;
  currencyPrefix: string;
  words: { service: string; staff: string; staffMany: string };
  example: { name: string; meta: string };
};

function toFormData(values: ServiceWizardValues, currency: string) {
  const data = new FormData();
  const money = (amount: number | null) => (amount === null ? "" : formatAmountInput(amount, currency));
  data.set("bookingType", values.bookingType);
  data.set("name", values.name);
  data.set("description", values.description);
  data.set("price", money(values.price));
  if (values.bookingType === "slot") {
    data.set("durationMinutes", String(values.durationMinutes));
    for (const id of values.staffIds) data.append("staffIds", id);
  } else {
    data.set("stayUnit", values.stayUnit);
    data.set("checkInTime", values.checkInTime);
    data.set("checkOutTime", values.checkOutTime);
    data.set("minStay", String(values.minStay));
    data.set("maxStay", values.maxStay === null ? "" : String(values.maxStay));
    data.set("weeklyPrice", money(values.weeklyPrice));
    data.set("monthlyPrice", money(values.monthlyPrice));
  }
  return data;
}

function stayValues(values: ServiceWizardValues) {
  return { ...values, price: values.price ?? 0 };
}

/** Only the issues a step owns (so each screen talks about its own question). */
function only<V>(issues: Issue<V>[], fields: string[]) {
  return issues.filter((found) => fields.includes(found.field));
}

export function ServiceWizard({ initial, edit, staffOptions, showStaff, longestByStaff, currency, currencyPrefix, words, example }: Props) {
  const router = useRouter();
  const isStay = (v: ServiceWizardValues) => v.bookingType === "stay";
  const relevantStaff = (v: ServiceWizardValues) => (showStaff ? v.staffIds : staffOptions.map((option) => option.id));
  const longestFor = (v: ServiceWizardValues) => {
    const known = relevantStaff(v).map((id) => longestByStaff[id]).filter((minutes) => minutes !== undefined);
    return known.length > 0 ? Math.max(...known) : null;
  };

  const steps: WizardStep<ServiceWizardValues>[] = [
    {
      id: "tipo",
      label: "Cómo se reserva",
      title: "¿Cómo te reservan?",
      why: "Elegí según lo que ofrecés. Lo podés cambiar después.",
      fields: ["bookingType"],
      render: ({ values, set }) => (
        <div className="grid gap-3" role="radiogroup" aria-label="Cómo se reserva">
          <ChoiceCard
            selected={values.bookingType === "slot"}
            onSelect={() => set({ bookingType: "slot" })}
            icon={<CalendarClockIcon className="size-5" />}
            title="Por horario"
            text="Turnos que duran minutos u horas: un corte, una consulta, una clase."
          />
          <ChoiceCard
            selected={values.bookingType === "stay"}
            onSelect={() => set({ bookingType: "stay" })}
            icon={<BedDoubleIcon className="size-5" />}
            title="Por días"
            text="Alquileres y estadías: el cliente elige el día que llega y el día que se va."
          />
        </div>
      ),
    },
    {
      id: "nombre",
      label: "Nombre",
      title: "¿Cómo se llama?",
      why: "Es lo que van a ver tus clientes al reservar. Usá un nombre corto y claro.",
      fields: ["name", "description"],
      issues: (v) => (v.name.trim().length < 2 ? [{ field: "name", message: "Escribí el nombre (al menos 2 letras).", fixes: [] }] : []),
      render: ({ values, set }) => (
        <div className="grid gap-4">
          <Field id="name" label="Nombre">
            <Input
              id="name"
              autoFocus
              value={values.name}
              placeholder={values.bookingType === "stay" ? "Casa de campo" : example.name}
              onChange={(event) => set({ name: event.target.value })}
            />
          </Field>
          <Field id="description" label="Descripción" optional hint="Un detalle que ayude a elegir. Podés dejarlo vacío.">
            <Textarea
              id="description"
              rows={2}
              value={values.description}
              placeholder={values.bookingType === "stay" ? "3 dormitorios, pileta y quincho." : "Incluye lavado y peinado."}
              onChange={(event) => set({ description: event.target.value })}
            />
          </Field>
        </div>
      ),
    },
    {
      id: "duracion",
      label: "Duración",
      title: "¿Cuánto dura?",
      why: `Es el tiempo que se aparta en tu agenda para cada ${words.service}. Tiene que entrar en tu horario de atención.`,
      skip: isStay,
      fields: ["durationMinutes"],
      issues: (v) => slotServiceIssues({ durationMinutes: v.durationMinutes }, { longestMinutes: longestFor(v) }),
      render: ({ values, set }) => {
        const hours = Math.floor(values.durationMinutes / 60);
        const minutes = values.durationMinutes % 60;
        const longest = longestFor(values);
        return (
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Duración">
              {SERVICE_DURATION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  role="radio"
                  aria-checked={values.durationMinutes === chip}
                  onClick={() => set({ durationMinutes: chip })}
                  className={cn(
                    "h-11 rounded-full border-2 px-4 text-sm font-bold",
                    values.durationMinutes === chip ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40",
                  )}
                >
                  {formatDuration(chip)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">Otra:</span>
              <Input
                aria-label="Horas"
                inputMode="numeric"
                className="w-16 text-center"
                value={String(hours)}
                onChange={(event) => set({ durationMinutes: (Number(event.target.value.replace(/\D/g, "")) || 0) * 60 + minutes })}
              />
              <span className="text-muted-foreground">h</span>
              <Input
                aria-label="Minutos"
                inputMode="numeric"
                className="w-16 text-center"
                value={String(minutes)}
                onChange={(event) => set({ durationMinutes: hours * 60 + Math.min(59, Number(event.target.value.replace(/\D/g, "")) || 0) })}
              />
              <span className="text-muted-foreground">min</span>
            </div>
            {longest === null ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ClockIcon className="size-4" aria-hidden="true" /> Todavía no definiste tu horario: lo vas a hacer después, en Horarios.
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ClockIcon className="size-4" aria-hidden="true" /> Tu día más largo es de {formatDuration(longest)}.
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: "cobro",
      label: "Noche o día",
      title: "¿Cobrás por noche o por día?",
      why: "Por noche: el cliente se queda a dormir (casas, cabañas). Por día: usa el lugar durante el día (salones, quinchos).",
      skip: (v) => !isStay(v),
      fields: ["stayUnit"],
      render: ({ values, set }) => (
        <div className="grid gap-3" role="radiogroup" aria-label="Se cobra por">
          <ChoiceCard
            selected={values.stayUnit === "night"}
            onSelect={() => set({ stayUnit: "night", checkInTime: "14:00", checkOutTime: "10:00" })}
            icon={<MoonIcon className="size-5" />}
            title="Por noche"
            text="Llega un día y se va otro. Ej.: entra 14:00, sale 10:00."
          />
          <ChoiceCard
            selected={values.stayUnit === "day"}
            onSelect={() => set({ stayUnit: "day", checkInTime: "09:00", checkOutTime: "20:00" })}
            icon={<SunIcon className="size-5" />}
            title="Por día"
            text="Usa el lugar y se va el mismo día. Ej.: de 09:00 a 20:00."
          />
        </div>
      ),
    },
    {
      id: "horas",
      label: "Entrada y salida",
      title: "¿A qué hora entran y salen?",
      why: "Tus clientes lo ven al reservar. Si cobrás por día, la salida tiene que ser después de la entrada.",
      skip: (v) => !isStay(v),
      fields: ["checkInTime", "checkOutTime"],
      issues: (v) => only(stayIssues(stayValues(v), currency), ["checkInTime", "checkOutTime"]),
      render: ({ values, set }) => (
        <div className="flex flex-wrap gap-6">
          <Field id="checkInTime" label="Entrada desde">
            <TimePicker id="checkInTime" aria-label="Hora de entrada" value={values.checkInTime} onChange={(checkInTime) => set({ checkInTime })} />
          </Field>
          <Field id="checkOutTime" label="Salida hasta">
            <TimePicker id="checkOutTime" aria-label="Hora de salida" value={values.checkOutTime} onChange={(checkOutTime) => set({ checkOutTime })} />
          </Field>
        </div>
      ),
    },
    {
      id: "estadia",
      label: "Mínimo y máximo",
      title: "¿Cuánto se pueden quedar?",
      why: "Por ejemplo, mínimo 2 noches los fines de semana. Si no tenés límite, dejá el máximo vacío.",
      skip: (v) => !isStay(v),
      fields: ["minStay", "maxStay"],
      issues: (v) => only(stayIssues(stayValues(v), currency), ["minStay", "maxStay"]),
      render: ({ values, set }) => (
        <div className="flex flex-wrap gap-6">
          <Field id="minStay" label={`Mínimo de ${STAY_UNIT_WORDS[values.stayUnit][1]}`}>
            <Input
              id="minStay"
              inputMode="numeric"
              className="w-24"
              value={String(values.minStay)}
              onChange={(event) => set({ minStay: Number(event.target.value.replace(/\D/g, "")) || 0 })}
            />
          </Field>
          <Field id="maxStay" label={`Máximo de ${STAY_UNIT_WORDS[values.stayUnit][1]}`} optional hint="Vacío = sin límite.">
            <Input
              id="maxStay"
              inputMode="numeric"
              className="w-24"
              value={values.maxStay === null ? "" : String(values.maxStay)}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, "");
                set({ maxStay: digits ? Number(digits) : null });
              }}
            />
          </Field>
        </div>
      ),
    },
    {
      id: "precio",
      label: "Precio",
      title: "¿Cuánto cuesta?",
      why: "Escribí solo números: los puntos se agregan solos.",
      fields: ["price", "weeklyPrice", "monthlyPrice"],
      issues: (v) =>
        isStay(v)
          ? only(stayIssues(stayValues(v), currency), ["price", "weeklyPrice", "monthlyPrice"])
          : v.price === null || v.price <= 0
            ? [{ field: "price", message: "Poné el precio (mayor a cero).", fixes: [] }]
            : [],
      render: ({ values, set }) => {
        const unit = STAY_UNIT_WORDS[values.stayUnit][0];
        const parse = (text: string) => (text ? parseMoneyInput(text, currency) : null);
        return (
          <div className="grid gap-4">
            <Field id="price" label={isStay(values) ? `Precio por ${unit}` : "Precio"}>
              <MoneyInput
                id="price"
                prefix={currencyPrefix}
                placeholder={isStay(values) ? "300.000" : "50.000"}
                defaultValue={values.price === null ? "" : formatAmountInput(values.price, currency)}
                onValueChange={(text) => set({ price: parse(text) })}
              />
            </Field>
            {isStay(values) && (
              <BundlePrices
                initiallyOpen={values.weeklyPrice !== null || values.monthlyPrice !== null}
                unitsWord={STAY_UNIT_WORDS[values.stayUnit][1]}
                currency={currency}
                currencyPrefix={currencyPrefix}
                weeklyPrice={values.weeklyPrice}
                monthlyPrice={values.monthlyPrice}
                onWeekly={(text) => set({ weeklyPrice: parse(text) })}
                onMonthly={(text) => set({ monthlyPrice: parse(text) })}
              />
            )}
          </div>
        );
      },
    },
    {
      id: "quien",
      label: "Quién lo hace",
      title: `¿Quién hace este ${words.service}?`,
      why: `Solo estas personas van a aparecer al reservar. Cada una atiende en su propio horario.`,
      skip: (v) => !showStaff || isStay(v),
      fields: ["staffIds"],
      issues: (v) => (v.staffIds.length === 0 ? [{ field: "staffIds", message: `Elegí al menos un ${words.staff}.`, fixes: [] }] : []),
      render: ({ values, set }) => (
        <div className="grid gap-2 sm:grid-cols-2">
          {staffOptions.map((option) => {
            const checked = values.staffIds.includes(option.id);
            return (
              <Label key={option.id} className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 font-semibold has-data-checked:border-primary has-data-checked:bg-primary-soft/40">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) =>
                    set({ staffIds: value === true ? [...values.staffIds, option.id] : values.staffIds.filter((id) => id !== option.id) })
                  }
                />
                <EntityAvatar name={option.name} size="sm" />
                <span className="flex flex-col">
                  {option.name}
                  {!option.hasHours && <span className="text-xs font-normal text-warning-foreground">Todavía no tiene horario</span>}
                </span>
              </Label>
            );
          })}
        </div>
      ),
    },
  ];

  function review(values: ServiceWizardValues) {
    const unit = values.stayUnit;
    return (
      <div className="grid gap-4">
        <p className="text-sm font-semibold text-muted-foreground">Así lo ven tus clientes:</p>
        <div className="flex items-center gap-4 rounded-2xl border-2 bg-background p-4">
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-bold">{values.name}</span>
            {values.description && <span className="text-sm text-muted-foreground">{values.description}</span>}
            <span className="text-sm text-muted-foreground">
              {isStay(values) ? `Por ${STAY_UNIT_WORDS[unit][0]} · entrada ${values.checkInTime} · salida ${values.checkOutTime}` : formatDuration(values.durationMinutes)}
            </span>
          </span>
          <span className="text-lg font-extrabold text-primary tabular">{formatMoney(values.price ?? 0, currency)}</span>
        </div>
        {isStay(values) && values.price ? (
          <p className="rounded-2xl bg-muted/60 p-4 text-sm">
            {[Math.max(values.minStay, 2), 7, 30]
              .filter((n, i, all) => all.indexOf(n) === i && (values.maxStay === null || n <= values.maxStay))
              .map((n) => `${stayAmount(unit, n)}: ${formatMoney(stayPrice(stayValues(values), n).total, currency)}`)
              .join(" · ")}
          </p>
        ) : null}
        {showStaff && !isStay(values) && (
          <p className="text-sm text-muted-foreground">
            Lo hacen: {staffOptions.filter((option) => values.staffIds.includes(option.id)).map((option) => option.name).join(", ")}
          </p>
        )}
      </div>
    );
  }

  async function onSubmit(values: ServiceWizardValues) {
    const data = toFormData(values, currency);
    if (edit) {
      const result = await updateServiceAction(edit.id, {}, data);
      if (!result.errors) router.push(`/dashboard/services/${edit.id}`);
      return result;
    }
    return createServiceAction({}, data);
  }

  return (
    <Wizard
      steps={steps}
      initial={initial}
      review={review}
      onSubmit={onSubmit}
      submitLabel={edit ? "Guardar cambio" : `Crear ${words.service}`}
      cancelHref={edit ? `/dashboard/services/${edit.id}` : "/dashboard/services"}
      editStep={edit?.step}
      successMessage={edit ? "Cambio guardado" : undefined}
    />
  );
}

/**
 * Optional weekly/monthly prices behind a question. Its open state is its
 * own, so clearing a price while typing never collapses the section.
 */
function BundlePrices({
  initiallyOpen,
  unitsWord,
  currency,
  currencyPrefix,
  weeklyPrice,
  monthlyPrice,
  onWeekly,
  onMonthly,
}: {
  initiallyOpen: boolean;
  unitsWord: string;
  currency: string;
  currencyPrefix: string;
  weeklyPrice: number | null;
  monthlyPrice: number | null;
  onWeekly: (text: string) => void;
  onMonthly: (text: string) => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <div className="rounded-2xl border p-4">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-left text-sm font-semibold">
        ¿Hacés precio especial por semana o por mes?
      </button>
      {open && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="weeklyPrice" label="Por semana" optional hint={`Se cobra cada 7 ${unitsWord}.`}>
            <MoneyInput
              id="weeklyPrice"
              prefix={currencyPrefix}
              defaultValue={weeklyPrice === null ? "" : formatAmountInput(weeklyPrice, currency)}
              onValueChange={onWeekly}
            />
          </Field>
          <Field id="monthlyPrice" label="Por mes" optional hint={`Se cobra cada 30 ${unitsWord}.`}>
            <MoneyInput
              id="monthlyPrice"
              prefix={currencyPrefix}
              defaultValue={monthlyPrice === null ? "" : formatAmountInput(monthlyPrice, currency)}
              onValueChange={onMonthly}
            />
          </Field>
        </div>
      )}
    </div>
  );
}
