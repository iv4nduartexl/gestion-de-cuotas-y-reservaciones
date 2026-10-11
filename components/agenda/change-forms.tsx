"use client";

import { useState } from "react";

import { getDashboardStayCalendarAction } from "@/app/dashboard/agenda/actions";
import { StayPicker, type StayOption, type StayRange } from "@/components/booking/stay-picker";
import { ClientPicker, type ClientOption } from "@/components/clients/client-picker";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { MoneyInput } from "@/components/forms/py-inputs";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui-kit/section-card";
import { ChoiceCard } from "@/components/wizard/wizard";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionState } from "@/lib/actions";
import { formatAmountInput, formatMoney } from "@/lib/money";
import { quoteStay } from "@/lib/stays";

type BoundAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

function SaveBar({ pending, disabled = false }: { pending: boolean; disabled?: boolean }) {
  return (
    <div className="sticky bottom-24 z-10 flex justify-end md:bottom-6">
      <Button type="submit" size="lg" disabled={pending || disabled} className="shadow-lift">
        {pending ? "Guardando…" : "Guardar cambio"}
      </Button>
    </div>
  );
}

/** "Cambiar precio" of a turno or rental. */
export function ChangePriceForm({ action, price, currency, currencyPrefix }: { action: BoundAction; price: number; currency: string; currencyPrefix: string }) {
  const { state, pending, formProps } = useFormAction(action, {});
  const errors = state.errors ?? {};
  return (
    <form {...formProps} noValidate className="flex max-w-xl flex-col gap-6">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <SectionCard title="¿Cuánto le cobrás?" description={`Ahora figura ${formatMoney(price, currency)}. Cambialo si le hiciste un descuento o le sumaste algo.`}>
        <Field id="price" label="Precio" error={errors.price}>
          <MoneyInput id="price" name="price" prefix={currencyPrefix} defaultValue={formatAmountInput(price, currency)} invalid={!!errors.price} />
        </Field>
      </SectionCard>
      <SaveBar pending={pending} />
    </form>
  );
}

/** "Cambiar cliente": the turno is someone else's. */
export function ChangeClientForm({ action, clientNoun, currentName }: { action: BoundAction; clientNoun: string; currentName: string }) {
  const { state, pending, formProps } = useFormAction(action, {});
  const errors = state.errors ?? {};
  const [client, setClient] = useState<ClientOption | null>(null);
  return (
    <form {...formProps} noValidate className="flex max-w-xl flex-col gap-6">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <SectionCard title={`¿De quién es este turno?`} description={`Ahora está a nombre de ${currentName}. Buscá a la persona correcta o cargala si es nueva.`}>
        <ClientPicker clientNoun={clientNoun} errors={errors} client={client} onClientChange={setClient} />
      </SectionCard>
      <SaveBar pending={pending} />
    </form>
  );
}

/** "Cambiar fechas" of a rental: the two calendars, then the new price or the old one. */
export function ChangeStayForm({
  action,
  appointmentId,
  stay,
  timeZone,
  current,
  currentPrice,
}: {
  action: BoundAction;
  appointmentId: string;
  stay: StayOption;
  timeZone: string;
  current: StayRange;
  currentPrice: number;
}) {
  const { state, pending, formProps } = useFormAction(action, {});
  const errors = state.errors ?? {};
  const [range, setRange] = useState<StayRange | null>(current);
  const [keepPrice, setKeepPrice] = useState(false);
  const quote = range ? quoteStay(stay, range.checkIn, range.checkOut, timeZone) : null;
  const newTotal = quote?.ok ? quote.quote.total : null;
  const unchanged = range?.checkIn === current.checkIn && range?.checkOut === current.checkOut;

  return (
    <form {...formProps} noValidate className="flex max-w-3xl flex-col gap-6">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <input type="hidden" name="checkIn" value={range?.checkIn ?? ""} />
      <input type="hidden" name="checkOut" value={range?.checkOut ?? ""} />
      <input type="hidden" name="keepPrice" value={String(keepPrice)} />
      <SectionCard title="¿Cuáles son las nuevas fechas?" description="Tocá el nuevo día de entrada y después el de salida. Las fechas de esta misma reserva cuentan como libres.">
        <StayPicker
          service={stay}
          timeZone={timeZone}
          value={range}
          onChange={setRange}
          loadCalendar={(fromDate) => getDashboardStayCalendarAction({ serviceId: stay.id, fromDate, excludeId: appointmentId })}
        />
        {(errors.checkIn || errors.checkOut) && <p className="text-sm text-destructive">{errors.checkIn ?? errors.checkOut}</p>}
      </SectionCard>
      {newTotal !== null && !unchanged && newTotal !== currentPrice && (
        <SectionCard title="¿Qué precio queda?" description="Con las nuevas fechas, el precio según tus tarifas cambia.">
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Precio">
            <ChoiceCard selected={!keepPrice} onSelect={() => setKeepPrice(false)} title={`Nuevo precio: ${formatMoney(newTotal, stay.currency)}`} text="Según las noches y tus tarifas." />
            <ChoiceCard selected={keepPrice} onSelect={() => setKeepPrice(true)} title={`Mantener ${formatMoney(currentPrice, stay.currency)}`} text="Lo que ya habían acordado." />
          </div>
        </SectionCard>
      )}
      <SaveBar pending={pending} disabled={!range || unchanged} />
    </form>
  );
}
