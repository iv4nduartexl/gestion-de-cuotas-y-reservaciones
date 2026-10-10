"use client";

import { Loader2Icon, SearchIcon, UserPlusIcon, XIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import {
  createAppointmentAction,
  getDashboardSlotsAction,
  searchClientsAction,
} from "@/app/dashboard/agenda/actions";
import { Field } from "@/components/forms/field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { DatePicker, PhoneInput, TimeSelect } from "@/components/forms/py-inputs";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { EntityAvatar } from "@/components/ui-kit/entity-avatar";
import { SectionCard } from "@/components/ui-kit/section-card";
import { useFormAction } from "@/hooks/use-form-action";
import { formatDuration } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

type ClientOption = { id: string; name: string; phone: string };
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

  // Client
  const [client, setClient] = useState<ClientOption | null>(null);
  const [newClient, setNewClient] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientOption[]>([]);
  const [searching, startSearch] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function search(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(() => {
      startSearch(async () => setResults(await searchClientsAction(value)));
    }, 250);
  }

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
      <input type="hidden" name="clientId" value={client?.id ?? ""} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="staffChoice" value={staffChoice} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="start" value={start} />
      <input type="hidden" name="manualTime" value={String(manual)} />
      <input type="hidden" name="time" value={time} />

      <SectionCard title={`¿Para quién?`} description={`Buscá un ${clientNoun} o cargá uno nuevo con su teléfono.`}>
        {client ? (
          <div className="flex items-center gap-3 rounded-2xl border bg-primary-soft/40 p-3">
            <EntityAvatar name={client.name} />
            <span className="flex flex-1 flex-col">
              <span className="font-bold">{client.name}</span>
              <span className="text-sm text-muted-foreground tabular">{formatPhone(client.phone)}</span>
            </span>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Cambiar cliente" onClick={() => setClient(null)}>
              <XIcon />
            </Button>
          </div>
        ) : newClient ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="newClientName" label="Nombre y apellido" error={errors.newClientName ?? errors.client} />
            <Field id="newClientPhone" label="Teléfono / WhatsApp" error={errors.newClientPhone}>
              <PhoneInput id="newClientPhone" name="newClientPhone" invalid={!!errors.newClientPhone} />
            </Field>
            <Button type="button" variant="ghost" className="w-fit" onClick={() => setNewClient(false)}>
              Buscar uno existente
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="relative">
              <span className="sr-only">Buscar {clientNoun}</span>
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => search(event.target.value)}
                placeholder="Nombre, teléfono o C.I."
                aria-label={`Buscar ${clientNoun}`}
                className="pl-9"
                autoComplete="off"
              />
              {searching && <Loader2Icon className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />}
            </label>
            {results.length > 0 && (
              <ul className="flex flex-col divide-y overflow-hidden rounded-2xl border">
                {results.map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => setClient(option)}
                      className="flex w-full cursor-pointer items-center gap-3 p-3 text-left hover:bg-muted"
                    >
                      <EntityAvatar name={option.name} size="sm" />
                      <span className="font-semibold">{option.name}</span>
                      <span className="ml-auto text-sm text-muted-foreground tabular">{formatPhone(option.phone)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim().length >= 2 && !searching && results.length === 0 && (
              <p className="text-sm text-muted-foreground">No encontramos a nadie con “{query}”.</p>
            )}
            <Button type="button" variant="soft" className="w-fit" onClick={() => setNewClient(true)}>
              <UserPlusIcon aria-hidden="true" /> {`Nuevo ${clientNoun}`}
            </Button>
            {errors.client && <p className="text-sm text-destructive">{errors.client}</p>}
          </div>
        )}
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
            <TimeSelect id="time" value={time} onChange={setTime} />
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
