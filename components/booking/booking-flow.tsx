"use client";

import {
  ArrowLeftIcon,
  BedDoubleIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  Loader2Icon,
  MoonIcon,
  SunIcon,
  SunriseIcon,
  UsersIcon,
} from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";

import {
  createBookingAction,
  createStayBookingAction,
  getAvailabilityAction,
  getStayCalendarAction,
  type BookingState,
  type PublicDay,
} from "@/app/[slug]/actions";
import { StayPicker, type StayOption, type StayRange } from "@/components/booking/stay-picker";
import { Field } from "@/components/forms/field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { PhoneInput } from "@/components/forms/py-inputs";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import { EntityAvatar } from "@/components/ui-kit/entity-avatar";
import { HorizontalScroller } from "@/components/ui-kit/horizontal-scroller";
import { addDaysToDate, formatCalendarDate, formatDuration } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { STAY_UNIT_WORDS, stayAmount } from "@/lib/service-constants";
import { quoteStay } from "@/lib/stays";
import { cn } from "@/lib/utils";

type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  currency: string;
  staffIds: string[];
};

type Step = "service" | "staff" | "time" | "stay" | "details";

export function BookingFlow({
  slug,
  services,
  stays,
  staff,
  showStaffStep,
  today,
  timeZone,
  autoConfirm,
}: {
  slug: string;
  services: Service[];
  /** Rentals ("Por días"): booked with a date range instead of a time. */
  stays: StayOption[];
  timeZone: string;
  staff: { id: string; name: string }[];
  showStaffStep: boolean;
  today: string;
  autoConfirm: boolean;
}) {
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState<string | null>(services.length === 1 && stays.length === 0 ? services[0].id : null);
  const [stayId, setStayId] = useState<string | null>(null);
  const [stayRange, setStayRange] = useState<StayRange | null>(null);
  const [staffChoice, setStaffChoice] = useState<string>("any");
  const [fromDate, setFromDate] = useState(today);
  const [days, setDays] = useState<PublicDay[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const [state, setState] = useState<BookingState>({});
  const [pending, startSubmit] = useTransition();
  const errors = state.errors ?? {};

  const stay = stays.find((s) => s.id === stayId) ?? null;
  const service = stay ? null : (services.find((s) => s.id === serviceId) ?? null);
  const stayQuote = stay && stayRange ? quoteStay(stay, stayRange.checkIn, stayRange.checkOut, timeZone) : null;
  const serviceStaff = service ? staff.filter((p) => service.staffIds.includes(p.id)) : [];
  const needsStaffStep = showStaffStep && serviceStaff.length > 1;
  const selectedDay = days?.find((d) => d.date === date) ?? null;
  const selectedSlot = selectedDay?.slots.find((s) => s.start === start) ?? null;

  function loadDays(query: { serviceId: string; staffChoice: string; fromDate: string }, keepDate = false) {
    setFromDate(query.fromDate);
    startLoading(async () => {
      const result = await getAvailabilityAction(slug, query);
      const nextDays = result?.days ?? [];
      setDays(nextDays);
      setHasMore(result?.hasMore ?? false);
      if (!keepDate || !nextDays.some((d) => d.date === date && d.slots.length > 0)) {
        setDate(nextDays.find((d) => d.slots.length > 0)?.date ?? null);
      }
      setStart(null);
    });
  }

  function chooseStay(id: string) {
    setStayId(id);
    setServiceId(null);
    setStayRange(null);
    setState({});
    setStep("stay");
  }

  function chooseService(id: string) {
    setStayId(null);
    setServiceId(id);
    setStaffChoice("any");
    setDays(null);
    setDate(null);
    setStart(null);
    setState({});
    const chosen = services.find((s) => s.id === id)!;
    const multiple = showStaffStep && staff.filter((p) => chosen.staffIds.includes(p.id)).length > 1;
    if (multiple) {
      setStep("staff");
    } else {
      setStep("time");
      loadDays({ serviceId: id, staffChoice: "any", fromDate: today });
    }
  }

  function chooseStaff(choice: string) {
    if (!serviceId) return;
    setStaffChoice(choice);
    setDays(null);
    setDate(null);
    setStart(null);
    setStep("time");
    loadDays({ serviceId, staffChoice: choice, fromDate: today });
  }

  function goBack() {
    if (step === "details") setStep(stay ? "stay" : "time");
    else if (step === "stay") setStep("service");
    else if (step === "time") setStep(needsStaffStep ? "staff" : "service");
    else if (step === "staff") setStep("service");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startSubmit(async () => {
      // On success the action redirects to the confirmation page.
      const result = stay ? await createStayBookingAction(slug, {}, formData) : await createBookingAction(slug, {}, formData);
      setState(result);
      if (result?.slotTaken && stay) {
        // Someone else booked those dates: choose again.
        setStayRange(null);
        setStep("stay");
      } else if (result?.slotTaken && serviceId) {
        // Someone else took the slot: refresh the times and choose again.
        setStep("time");
        loadDays({ serviceId, staffChoice, fromDate }, true);
      }
    });
  }

  const staffLabel =
    staffChoice === "any" ? "Cualquier profesional" : (staff.find((p) => p.id === staffChoice)?.name ?? "");

  const groups = selectedDay ? groupByDayPart(selectedDay.slots) : [];

  return (
    <div className="flex flex-col gap-6 pb-28">
      {step !== "service" && (
        <button
          type="button"
          onClick={goBack}
          className="flex w-fit cursor-pointer items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" /> Atrás
        </button>
      )}

      {step === "service" && (
        <section className="flex flex-col gap-4">
          <StepTitle number={1} title="Elegí el servicio" />
          <ul className="grid gap-3">
            {services.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => chooseService(s.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-4 rounded-2xl border-2 bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-soft",
                    s.id === serviceId ? "border-primary" : "border-border",
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-bold">{s.name}</span>
                    {s.description && <span className="text-sm text-muted-foreground">{s.description}</span>}
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <ClockIcon className="size-3.5" aria-hidden="true" /> {formatDuration(s.durationMinutes)}
                    </span>
                  </span>
                  <span className="text-lg font-extrabold text-primary tabular">{formatMoney(s.price, s.currency)}</span>
                  <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            ))}
            {stays.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => chooseStay(s.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-4 rounded-2xl border-2 bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-soft",
                    s.id === stayId ? "border-primary" : "border-border",
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-bold">{s.name}</span>
                    {s.description && <span className="text-sm text-muted-foreground">{s.description}</span>}
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <BedDoubleIcon className="size-3.5" aria-hidden="true" /> Por {STAY_UNIT_WORDS[s.stayUnit][0]} · entrada {s.checkInTime}
                    </span>
                  </span>
                  <span className="flex flex-col items-end">
                    <span className="text-lg font-extrabold text-primary tabular">{formatMoney(s.price, s.currency)}</span>
                    <span className="text-xs text-muted-foreground">por {STAY_UNIT_WORDS[s.stayUnit][0]}</span>
                  </span>
                  <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {step === "stay" && stay && (
        <section className="flex flex-col gap-4">
          <StepTitle number={2} title="Elegí las fechas" />
          {errors.checkIn && <FormMessage type="error">{errors.checkIn}</FormMessage>}
          <StayPicker
            key={stay.id}
            service={stay}
            timeZone={timeZone}
            value={stayRange}
            onChange={setStayRange}
            loadCalendar={(fromDate) => getStayCalendarAction(slug, { serviceId: stay.id, fromDate })}
          />
        </section>
      )}

      {step === "staff" && service && (
        <section className="flex flex-col gap-4">
          <StepTitle number={2} title={`¿Con quién?`} />
          <ul className="grid gap-3 sm:grid-cols-2">
            <li>
              <ChoiceButton selected={staffChoice === "any"} onClick={() => chooseStaff("any")}>
                <span className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <UsersIcon className="size-5" aria-hidden="true" />
                </span>
                <span className="flex flex-col">
                  <span className="font-bold">Cualquiera</span>
                  <span className="text-sm text-muted-foreground">Más horarios disponibles</span>
                </span>
              </ChoiceButton>
            </li>
            {serviceStaff.map((person) => (
              <li key={person.id}>
                <ChoiceButton selected={staffChoice === person.id} onClick={() => chooseStaff(person.id)}>
                  <EntityAvatar name={person.name} />
                  <span className="font-bold">{person.name}</span>
                </ChoiceButton>
              </li>
            ))}
          </ul>
        </section>
      )}

      {step === "time" && service && (
        <section className="flex flex-col gap-4">
          <StepTitle number={needsStaffStep ? 3 : 2} title="Elegí día y hora" />
          {errors.start && <FormMessage type="error">{errors.start}</FormMessage>}

          {days === null || (loading && !days.length) ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> Buscando horarios…
            </div>
          ) : (
            <>
              <HorizontalScroller label="Días" className="flex gap-2 pb-1" role="listbox" aria-label="Días">
                {days.map((day) => {
                  const available = day.slots.length > 0;
                  const active = day.date === date;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      role="option"
                      data-date={day.date}
                      aria-selected={active}
                      disabled={!available}
                      onClick={() => {
                        setDate(day.date);
                        setStart(null);
                      }}
                      className={cn(
                        "flex w-16 shrink-0 cursor-pointer flex-col items-center gap-0.5 rounded-2xl border-2 py-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40",
                      )}
                    >
                      <span className="text-xs font-semibold capitalize">{formatCalendarDate(day.date, "EEE")}</span>
                      <span className="text-xl font-extrabold">{formatCalendarDate(day.date, "d")}</span>
                      <span className="text-[11px] capitalize">{formatCalendarDate(day.date, "MMM")}</span>
                    </button>
                  );
                })}
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => loadDays({ serviceId: service.id, staffChoice, fromDate: addDaysToDate(fromDate, days.length) })}
                    className="flex w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <CalendarDaysIcon className="size-5" aria-hidden="true" />
                    Más días
                  </button>
                )}
              </HorizontalScroller>
              {fromDate !== today && (
                <button
                  type="button"
                  onClick={() => loadDays({ serviceId: service.id, staffChoice, fromDate: today })}
                  className="w-fit cursor-pointer text-sm font-semibold text-primary"
                >
                  Volver a hoy
                </button>
              )}

              {days.every((day) => day.slots.length === 0) ? (
                <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
                  No hay horarios libres en estos días.{" "}
                  {hasMore ? "Probá con “Más días”." : "Probá más adelante o escribile al negocio."}
                </p>
              ) : selectedDay ? (
                <div className={cn("flex flex-col gap-5", loading && "opacity-60")}>
                  <p className="font-semibold first-letter:uppercase">{formatCalendarDate(selectedDay.date, "EEEE d 'de' MMMM")}</p>
                  {groups.map((group) => (
                    <div key={group.label} className="flex flex-col gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                        <group.icon className="size-4" aria-hidden="true" /> {group.label}
                      </span>
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                        {group.slots.map((slot) => (
                          <button
                            key={slot.start}
                            type="button"
                            aria-pressed={slot.start === start}
                            onClick={() => setStart(slot.start)}
                            className={cn(
                              "h-11 cursor-pointer rounded-xl border-2 text-sm font-bold tabular transition-colors",
                              slot.start === start
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card hover:border-primary/50",
                            )}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </section>
      )}

      {step === "details" && ((service && selectedSlot) || (stay && stayRange)) && (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <StepTitle number={stay ? 3 : needsStaffStep ? 4 : 3} title="Tus datos" />
          <p className="-mt-2 text-sm text-muted-foreground">
            Los usamos solo para tu reserva. No hace falta crear una cuenta.
          </p>
          {errors.form && <FormMessage type="error">{errors.form}</FormMessage>}
          {stay && stayRange ? (
            <>
              <input type="hidden" name="serviceId" value={stay.id} />
              <input type="hidden" name="checkIn" value={stayRange.checkIn} />
              <input type="hidden" name="checkOut" value={stayRange.checkOut} />
            </>
          ) : (
            <>
              <input type="hidden" name="serviceId" value={service!.id} />
              <input type="hidden" name="staffChoice" value={staffChoice} />
              <input type="hidden" name="start" value={selectedSlot!.start} />
            </>
          )}
          {/* Honeypot: hidden from people, tempting for bots. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Sitio web
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <FormField name="name" label="Nombre y apellido" autoComplete="name" error={errors.name} />
          <Field id="phone" label="Teléfono / WhatsApp" error={errors.phone} hint="Te avisamos por acá si hay algún cambio.">
            <PhoneInput id="phone" name="phone" invalid={!!errors.phone} />
          </Field>
          <TextareaField name="notes" label="Comentario" optional rows={2} placeholder="Algo que el negocio deba saber" error={errors.notes} />
          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending ? "Reservando…" : autoConfirm ? (stay ? "Confirmar reserva" : "Confirmar turno") : stay ? "Solicitar reserva" : "Solicitar turno"}
          </Button>
          {!autoConfirm && (
            <p className="text-center text-xs text-muted-foreground">
              El negocio confirma cada reserva. Te va a quedar como “pendiente” hasta entonces.
            </p>
          )}
        </form>
      )}

      {stay && step !== "service" && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col text-sm leading-tight">
              <span className="truncate font-bold">{stay.name}</span>
              <span className="truncate text-muted-foreground">
                {stayRange && stayQuote?.ok
                  ? `${formatCalendarDate(stayRange.checkIn, "d/MM")} → ${formatCalendarDate(stayRange.checkOut, "d/MM")} · ${stayAmount(stay.stayUnit, stayQuote.quote.units)}`
                  : "Elegí entrada y salida"}
              </span>
            </div>
            {step === "stay" && (
              <Button type="button" disabled={!stayQuote?.ok} onClick={() => setStep("details")}>
                Continuar
              </Button>
            )}
            {step === "details" && stayQuote?.ok && (
              <span className="flex items-center gap-1 text-sm font-bold text-primary tabular">
                <CheckIcon className="size-4" aria-hidden="true" /> {formatMoney(stayQuote.quote.total, stay.currency)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Summary + next step, always at hand on phones. */}
      {service && step !== "service" && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col text-sm leading-tight">
              <span className="truncate font-bold">{service.name}</span>
              <span className="truncate text-muted-foreground">
                {[
                  showStaffStep && serviceStaff.length > 1 ? staffLabel : null,
                  selectedSlot && selectedDay
                    ? `${formatCalendarDate(selectedDay.date, "EEE d/MM")} · ${selectedSlot.time}`
                    : formatDuration(service.durationMinutes),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            {step === "time" && (
              <Button type="button" disabled={!selectedSlot} onClick={() => setStep("details")}>
                Continuar
              </Button>
            )}
            {step === "details" && (
              <span className="flex items-center gap-1 text-sm font-bold text-primary tabular">
                <CheckIcon className="size-4" aria-hidden="true" /> {formatMoney(service.price, service.currency)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StepTitle({ number, title }: { number: number; title: string }) {
  return (
    <h2 className="flex items-center gap-3 text-xl font-extrabold">
      <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
        {number}
      </span>
      {title}
    </h2>
  );
}

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-2xl border-2 bg-card p-4 text-left transition-all hover:border-primary/40",
        selected ? "border-primary" : "border-border",
      )}
    >
      {children}
    </button>
  );
}

function groupByDayPart(slots: { start: string; time: string }[]) {
  const parts = [
    { label: "Mañana", icon: SunriseIcon, test: (h: number) => h < 12 },
    { label: "Tarde", icon: SunIcon, test: (h: number) => h >= 12 && h < 18 },
    { label: "Noche", icon: MoonIcon, test: (h: number) => h >= 18 },
  ];
  return parts
    .map((part) => ({ ...part, slots: slots.filter((slot) => part.test(Number(slot.time.slice(0, 2)))) }))
    .filter((part) => part.slots.length > 0);
}
