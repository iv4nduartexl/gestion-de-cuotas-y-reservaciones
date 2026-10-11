// Small mockups of what each part of Agenda produces. Built from the real UI
// pieces (no images), so they follow the theme, dark mode and vocabulary.
// Used by the welcome tour and the setup guide.

import { CalendarCheckIcon, CheckCheckIcon, MessageCircleIcon } from "lucide-react";

import { ChargeBadge } from "@/components/memberships/charge-badge";
import { Badge } from "@/components/ui/badge";
import { EntityAvatar } from "@/components/ui-kit/entity-avatar";
import { cn } from "@/lib/utils";

function Frame({ caption, children, className }: { caption?: string; children: React.ReactNode; className?: string }) {
  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <div className="rounded-2xl border bg-background/80 p-3 shadow-soft" aria-hidden="true">
        {children}
      </div>
      {caption && <figcaption className="text-xs font-semibold text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}

/** The public booking page on a phone. */
export function BookingPhonePreview({
  businessName,
  services,
  caption = "Así lo ven tus clientes",
}: {
  businessName: string;
  services: { name: string; meta: string }[];
  caption?: string;
}) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <div className="w-56 rounded-[2rem] border-4 border-foreground/80 bg-background p-2 shadow-soft" aria-hidden="true">
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-foreground/20" />
        <div className="flex flex-col gap-2 rounded-2xl bg-primary px-3 py-3 text-primary-foreground">
          <span className="text-[10px] font-bold tracking-wide uppercase opacity-80">Reservá tu turno</span>
          <span className="truncate text-sm font-extrabold">{businessName}</span>
        </div>
        <ul className="mt-2 flex flex-col gap-1.5">
          {services.slice(0, 3).map((service, index) => (
            <li
              key={service.name}
              className={cn("flex flex-col rounded-xl border px-2.5 py-1.5", index === 0 && "border-primary bg-primary-soft/60")}
            >
              <span className="truncate text-xs font-bold">{service.name}</span>
              <span className="truncate text-[10px] text-muted-foreground">{service.meta}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {["09:00", "09:30", "10:00"].map((time, index) => (
            <span
              key={time}
              className={cn("rounded-lg border py-1 text-center text-[10px] font-bold tabular", index === 1 && "border-primary bg-primary text-primary-foreground")}
            >
              {time}
            </span>
          ))}
        </div>
      </div>
      {caption && <figcaption className="text-xs font-semibold text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}

const EXAMPLE_WEEK: [string, [number, number][]][] = [
  ["Lun", [[8 * 60, 12 * 60], [14 * 60, 19 * 60]]],
  ["Mar", [[8 * 60, 12 * 60], [14 * 60, 19 * 60]]],
  ["Mié", [[8 * 60, 12 * 60], [14 * 60, 19 * 60]]],
  ["Jue", [[8 * 60, 12 * 60], [14 * 60, 19 * 60]]],
  ["Vie", [[8 * 60, 12 * 60], [14 * 60, 19 * 60]]],
  ["Sáb", [[8 * 60, 12 * 60]]],
  ["Dom", []],
];
const SHORT_DAYS = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * A week of opening hours as bars. Without `days` it shows an example; with
 * them, the real schedule ({ weekday, ranges: [{ start, end }] }).
 */
export function WeekPreview({
  caption = "Ejemplo: corte al mediodía y sábados a la mañana",
  days,
}: {
  caption?: string;
  days?: { weekday: number; ranges: { start: string; end: string }[] }[];
}) {
  const week: [string, [number, number][]][] = days
    ? [1, 2, 3, 4, 5, 6, 7].map((weekday) => [
        SHORT_DAYS[weekday],
        (days.find((day) => day.weekday === weekday)?.ranges ?? [])
          .map((range) => [toMinutes(range.start), toMinutes(range.end)] as [number, number])
          .sort((a, b) => a[0] - b[0]),
      ])
    : EXAMPLE_WEEK;
  const all = week.flatMap(([, ranges]) => ranges.flat());
  const from = Math.min(6 * 60, ...all);
  const to = Math.max(21 * 60, ...all);
  const span = to - from;
  return (
    <Frame caption={caption}>
      <ul className="flex flex-col gap-1.5">
        {week.map(([day, ranges]) => (
          <li key={day} className="flex items-center gap-2">
            <span className="w-8 text-[11px] font-bold text-muted-foreground">{day}</span>
            <span className="relative h-3 flex-1 rounded-full bg-muted">
              {ranges.map(([start, end]) => (
                <span
                  key={start}
                  className="absolute inset-y-0 rounded-full bg-primary"
                  style={{ left: `${((start - from) / span) * 100}%`, width: `${((end - start) / span) * 100}%` }}
                />
              ))}
            </span>
            <span className="w-24 text-right text-[10px] text-muted-foreground tabular">
              {ranges.length === 0 ? "Cerrado" : `${hhmm(ranges[0][0])}–${hhmm(ranges[ranges.length - 1][1])}`}
            </span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

/** A few cuotas with their states. */
export function CuotasPreview({ plan, caption = "Así ves quién pagó y quién debe" }: { plan: string; caption?: string }) {
  const rows = [
    { name: "María González", status: "pagada" as const, amount: "Gs. 150.000" },
    { name: "Juan Benítez", status: "pendiente" as const, amount: "Gs. 150.000" },
    { name: "Sofía Ramírez", status: "vencida" as const, amount: "Gs. 150.000" },
  ];
  return (
    <Frame caption={caption}>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.name} className="flex items-center gap-2 rounded-xl border bg-card px-2.5 py-2">
            <EntityAvatar name={row.name} size="sm" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xs font-bold">{row.name}</span>
              <span className="truncate text-[10px] text-muted-foreground">
                {plan} · {row.amount}
              </span>
            </span>
            <ChargeBadge status={row.status} />
          </li>
        ))}
      </ul>
    </Frame>
  );
}

/** A WhatsApp message bubble. */
export function WhatsAppPreview({ text, caption = "El mensaje ya va escrito: solo tocás enviar" }: { text: string; caption?: string }) {
  return (
    <Frame caption={caption} className="max-w-sm">
      <div className="flex flex-col gap-2 rounded-xl bg-[#e7ddd3] p-3 dark:bg-[#1f2c33]">
        <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-xs leading-relaxed text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
          {text}
          <span className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-60">
            09:00 <CheckCheckIcon className="size-3" />
          </span>
        </div>
      </div>
    </Frame>
  );
}

/** The team: each person with their own hours. */
export function TeamPreview({ staffWord, caption }: { staffWord: string; caption?: string }) {
  const people = [
    { name: "Carlos Duarte", hours: "Lun a Vie · 8 a 17" },
    { name: "Lorena Paredes", hours: "Mar a Sáb · 10 a 19" },
  ];
  return (
    <Frame caption={caption ?? `Cada ${staffWord} con su horario`}>
      <ul className="flex flex-col gap-1.5">
        {people.map((person) => (
          <li key={person.name} className="flex items-center gap-2 rounded-xl border bg-card px-2.5 py-2">
            <EntityAvatar name={person.name} size="sm" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-xs font-bold">{person.name}</span>
              <span className="truncate text-[10px] text-muted-foreground">{person.hours}</span>
            </span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

/** A client card with the one-tap WhatsApp button. */
export function ClientPreview({ caption = "Su ficha, con WhatsApp a un toque" }: { caption?: string }) {
  return (
    <Frame caption={caption}>
      <div className="flex items-center gap-2 rounded-xl border bg-card px-2.5 py-2">
        <EntityAvatar name="Ana Martínez" size="sm" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-xs font-bold">Ana Martínez</span>
          <span className="truncate text-[10px] text-muted-foreground tabular">0981 123 456 · C.I. 4.567.890</span>
        </span>
        <span className="flex size-7 items-center justify-center rounded-lg bg-success-soft text-success-foreground">
          <MessageCircleIcon className="size-3.5" />
        </span>
      </div>
    </Frame>
  );
}

/** A turno arriving in the agenda. */
export function TurnoPreview({ service, caption = "Y el turno aparece solo en tu Agenda" }: { service: string; caption?: string }) {
  return (
    <Frame caption={caption}>
      <div className="flex items-center gap-2 rounded-xl border-l-4 border-primary bg-card px-2.5 py-2">
        <CalendarCheckIcon className="size-4 text-primary" />
        <span className="w-10 text-xs font-extrabold tabular">09:30</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-xs font-bold">Ana Martínez</span>
          <span className="truncate text-[10px] text-muted-foreground">{service}</span>
        </span>
        <Badge variant="success">Confirmado</Badge>
      </div>
    </Frame>
  );
}
