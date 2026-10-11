"use client";

import { useState } from "react";

import { createStayAppointmentAction, getDashboardStayCalendarAction } from "@/app/dashboard/agenda/actions";
import { StayPicker, type StayOption, type StayRange } from "@/components/booking/stay-picker";
import { ClientPicker, type ClientOption } from "@/components/clients/client-picker";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { MoneyInput } from "@/components/forms/py-inputs";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui-kit/section-card";
import { ChoiceCard } from "@/components/wizard/wizard";
import { useFormAction } from "@/hooks/use-form-action";
import { maskGuaranies } from "@/lib/masks";
import { formatMoney } from "@/lib/money";
import { STAY_UNIT_WORDS } from "@/lib/service-constants";
import { quoteStay } from "@/lib/stays";

/** Dashboard rental booking: client → rental → dates → price → notes. */
export function NewStayForm({ stays, timeZone, clientNoun }: { stays: StayOption[]; timeZone: string; clientNoun: string }) {
  const { state, pending, formProps } = useFormAction(createStayAppointmentAction, {});
  const errors = state.errors ?? {};
  const [client, setClient] = useState<ClientOption | null>(null);
  const [serviceId, setServiceId] = useState(stays[0]?.id ?? "");
  const [range, setRange] = useState<StayRange | null>(null);

  const stay = stays.find((s) => s.id === serviceId) ?? stays[0];
  const quote = range ? quoteStay(stay, range.checkIn, range.checkOut, timeZone) : null;
  const total = quote?.ok ? quote.quote.total : null;

  return (
    <form {...formProps} noValidate className="flex max-w-3xl flex-col gap-6">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <input type="hidden" name="serviceId" value={stay.id} />
      <input type="hidden" name="checkIn" value={range?.checkIn ?? ""} />
      <input type="hidden" name="checkOut" value={range?.checkOut ?? ""} />

      <SectionCard title="1. ¿Para quién?" description={`Buscá un ${clientNoun} o cargá uno nuevo con su teléfono.`}>
        <ClientPicker clientNoun={clientNoun} errors={errors} client={client} onClientChange={setClient} />
      </SectionCard>

      {stays.length > 1 && (
        <SectionCard title="2. ¿Qué alquila?">
          <div role="radiogroup" aria-label="Alquiler" className="grid gap-3 sm:grid-cols-2">
            {stays.map((option) => (
              <ChoiceCard
                key={option.id}
                selected={option.id === stay.id}
                onSelect={() => {
                  setServiceId(option.id);
                  setRange(null);
                }}
                title={option.name}
                text={`${formatMoney(option.price, option.currency)} por ${STAY_UNIT_WORDS[option.stayUnit][0]}`}
              />
            ))}
          </div>
          {errors.serviceId && <p className="text-sm text-destructive">{errors.serviceId}</p>}
        </SectionCard>
      )}

      <SectionCard
        title={`${stays.length > 1 ? 3 : 2}. ¿Qué fechas?`}
        description="Primero tocá el día de entrada y después el de salida. Los días ocupados no se pueden elegir."
      >
        <StayPicker
          key={stay.id}
          service={stay}
          timeZone={timeZone}
          value={range}
          onChange={setRange}
          loadCalendar={(fromDate) => getDashboardStayCalendarAction({ serviceId: stay.id, fromDate })}
        />
        {(errors.checkIn || errors.checkOut) && <p className="text-sm text-destructive">{errors.checkIn ?? errors.checkOut}</p>}
      </SectionCard>

      {total !== null && (
        <SectionCard
          title={`${stays.length > 1 ? 4 : 3}. ¿Cuánto cobrás?`}
          description="Ya calculamos el precio con tus tarifas. Cambialo solo si acordaste otro monto."
        >
          <Field id="price" label="Precio total" error={errors.price}>
            {/* Remount with the new quote whenever the dates change. */}
            <MoneyInput
              key={`${range?.checkIn}-${range?.checkOut}`}
              id="price"
              name="price"
              defaultValue={maskGuaranies(String(total))}
              invalid={!!errors.price}
            />
          </Field>
          <TextareaField name="notes" label="Comentario" optional rows={2} error={errors.notes} />
        </SectionCard>
      )}

      <div className="sticky bottom-24 z-10 flex justify-end md:bottom-6">
        <Button type="submit" size="lg" disabled={pending || total === null} className="shadow-lift">
          {pending ? "Agendando…" : "Agendar alquiler"}
        </Button>
      </div>
    </form>
  );
}
