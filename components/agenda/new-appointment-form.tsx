"use client";

import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";

import { createAppointmentAction, getDashboardSlotsAction } from "@/app/dashboard/agenda/actions";
import { ClientPicker, type ClientOption } from "@/components/clients/client-picker";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { DatePicker } from "@/components/forms/py-inputs";
import { TimePicker } from "@/components/forms/time-picker";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { SectionCard } from "@/components/ui-kit/section-card";
import { useFormAction } from "@/hooks/use-form-action";
import { formatDuration } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type ServiceOption = { id: string; name: string; durationMinutes: number; price: number; currency: string; staffIds: string[] };

export function NewAppointmentForm({
  services,
  staff,
  showStaff,
  lockedStaffId,
  initialDate,
  initialStaffId,
  initialSlots,
  clientNoun,
}: {
  services: ServiceOption[];
  staff: { id: string; name: string }[];
  showStaff: boolean;
  /** Members can only book for themselves. */
  lockedStaffId: string | null;
  initialDate: string;
  initialStaffId: string | null;
  initialSlots: { start: string; time: string }[];
  clientNoun: string;
}) {
  const { state, pending, formProps } = useFormAction(createAppointmentAction, {});
  const errors = state.errors ?? {};

  const [client, setClient] = useState<ClientOption | null>(null);

  // Turno
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [staffChoice, setStaffChoice] = useState(lockedStaffId ?? initialStaffId ?? "any");
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<{ start: string; time: string }[]>(initialSlots);
  const [start, setStart] = useState("");
  const [manual, setManual] = useState(false);
  const [time, setTime] = useState("09:00");
  const [loadingSlots, startSlots] = useTransition();

  const service = services.find((s) => s.id === serviceId);
  const staffForService = service ? staff.filter((p) => service.staffIds.includes(p.id)) : [];

  function loadSlots(next: { serviceId: string; staffChoice: string; date: string }) {
    setStart("");
    if (!next.serviceId || !next.date) return;
    startSlots(async () => setSlots(await getDashboardSlotsAction(next)));
  }

  const update = (patch: Partial<{ serviceId: string; staffChoice: string; date: string }>) => {
    const next = { serviceId, staffChoice, date, ...patch };
    if (patch.serviceId !== undefined) setServiceId(patch.serviceId);
    if (patch.staffChoice !== undefined) setStaffChoice(patch.staffChoice);
    if (patch.date !== undefined) setDate(patch.date);
    if (!manual) loadSlots(next);
  };

  return (
    <form {...formProps} noValidate className="flex max-w-3xl flex-col gap-6">
      {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="staffChoice" value={staffChoice} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="start" value={start} />
      <input type="hidden" name="manualTime" value={String(manual)} />
      <input type="hidden" name="time" value={time} />

      <SectionCard title={`¿Para quién?`} description={`Buscá un ${clientNoun} o cargá uno nuevo con su teléfono.`}>
        <ClientPicker clientNoun={clientNoun} errors={errors} client={client} onClientChange={setClient} />
      </SectionCard>

      <SectionCard title="Turno">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="service" label="Servicio" error={errors.serviceId}>
            <NativeSelect id="service" className="w-full" value={serviceId} onChange={(event) => update({ serviceId: event.target.value })}>
              {services.map((s) => (
                <NativeSelectOption key={s.id} value={s.id}>
                  {s.name} · {formatDuration(s.durationMinutes)} · {formatMoney(s.price, s.currency)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {showStaff && !lockedStaffId && (
            <Field id="staff" label="Con" error={errors.staffChoice}>
              <NativeSelect id="staff" className="w-full" value={staffChoice} onChange={(event) => update({ staffChoice: event.target.value })}>
                {!manual && <NativeSelectOption value="any">Cualquiera libre</NativeSelectOption>}
                {(manual ? staff : staffForService).map((p) => (
                  <NativeSelectOption key={p.id} value={p.id}>
                    {p.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field id="date" label="Día" error={errors.date}>
            <DatePicker id="date" name="dateDisplay" value={date} onChange={(value) => update({ date: value })} />
          </Field>
        </div>

        <Label className="flex w-fit cursor-pointer items-center gap-3 font-semibold">
          <Switch
            checked={manual}
            onCheckedChange={(checked) => {
              setManual(checked);
              if (checked && staffChoice === "any") setStaffChoice(lockedStaffId ?? staffForService[0]?.id ?? staff[0]?.id ?? "any");
              if (!checked) loadSlots({ serviceId, staffChoice, date });
            }}
          />
          Elegir la hora a mano
          <span className="font-normal text-muted-foreground">(fuera de los horarios libres)</span>
        </Label>

        {manual ? (
          <Field id="time" label="Hora" error={errors.time}>
            <TimePicker id="time" aria-label="Hora" value={time} onChange={setTime} />
          </Field>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Horarios libres</span>
            {loadingSlots ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> Buscando…
              </span>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay horarios libres ese día. Probá otro día o elegí la hora a mano.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                {slots.map((slot) => (
                  <button
                    key={slot.start}
                    type="button"
                    aria-pressed={slot.start === start}
                    onClick={() => setStart(slot.start)}
                    className={cn(
                      "h-10 cursor-pointer rounded-xl border-2 text-sm font-bold tabular transition-colors",
                      slot.start === start ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50",
                    )}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            )}
            {errors.start && <p className="text-sm text-destructive">{errors.start}</p>}
          </div>
        )}

        <TextareaField name="notes" label="Comentario" optional rows={2} error={errors.notes} />
      </SectionCard>

      <div className="sticky bottom-24 z-10 flex justify-end md:bottom-6">
        <Button type="submit" size="lg" disabled={pending || (!manual && !start)} className="shadow-lift">
          {pending ? "Agendando…" : "Agendar turno"}
        </Button>
      </div>
    </form>
  );
}
