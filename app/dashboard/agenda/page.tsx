import { BedDoubleIcon, CalendarPlusIcon, CalendarXIcon, HourglassIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AgendaDayNav } from "@/components/agenda/day-nav";
import { AppointmentList } from "@/components/agenda/appointment-list";
import { DayGrid } from "@/components/agenda/day-grid";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { EntityAvatar } from "@/components/ui-kit/entity-avatar";
import { PageHeader } from "@/components/ui-kit/page-header";
import { requireProduct } from "@/lib/actions";
import { isoWeekday } from "@/lib/availability";
import { countPendingAppointments, listAppointmentsBetween } from "@/lib/data/appointments";
import { loadStaffAvailability } from "@/lib/data/availability";
import { listStaff } from "@/lib/data/staff";
import { addDaysToDate, DATE_PATTERN, formatInZone, timeToMinutes, todayInZone, zonedToUtc } from "@/lib/datetime";
import { stayUnits } from "@/lib/stays";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Agenda" };

export default function AgendaPage({ searchParams }: PageProps<"/dashboard/agenda">) {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <Agenda searchParams={searchParams} />
    </Suspense>
  );
}

async function Agenda({ searchParams }: { searchParams: PageProps<"/dashboard/agenda">["searchParams"] }) {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "appointments");
  const tz = ctx.settings.timezone;
  const today = todayInZone(tz);
  const params = await searchParams;
  const date = typeof params.fecha === "string" && DATE_PATTERN.test(params.fecha) ? params.fecha : today;
  const isTeam = ctx.settings.teamMode === "team";

  const people = await listStaff(ctx);
  const persona = isTeam && typeof params.persona === "string" ? people.find((p) => p.id === params.persona) : undefined;

  const dayStart = zonedToUtc(date, "00:00", tz);
  const dayEnd = zonedToUtc(addDaysToDate(date, 1), "00:00", tz);
  const [dayBookings, pending, availability] = await Promise.all([
    listAppointmentsBetween(ctx, { from: dayStart, to: dayEnd, staffId: persona?.id }),
    countPendingAppointments(ctx),
    loadStaffAvailability(ctx, { staffIds: people.map((p) => p.id), from: dayStart, to: dayEnd }),
  ]);

  // Rentals ("Por días") span days and have no staff: shown in their own band.
  const stays = dayBookings.filter((booking) => booking.kind === "stay");
  const turnos = dayBookings.filter((booking) => booking.kind !== "stay");

  const hrefFor = (next: { fecha?: string; persona?: string | null }) => {
    const search = new URLSearchParams();
    const nextDate = next.fecha ?? date;
    if (nextDate !== today) search.set("fecha", nextDate);
    const nextPersona = next.persona === undefined ? persona?.id : next.persona;
    if (nextPersona) search.set("persona", nextPersona);
    const query = search.toString();
    return `/dashboard/agenda${query ? `?${query}` : ""}`;
  };

  const weekday = isoWeekday(date);
  const hoursFor = (staffId: string) =>
    (availability.find((a) => a.staffId === staffId)?.rules ?? [])
      .filter((rule) => rule.weekday === weekday)
      .map((rule) => ({ start: rule.startTime, end: rule.endTime }));

  // Grid range: working hours and turnos of the day, at least 08–18.
  const minutes = [
    ...people.flatMap((p) => hoursFor(p.id).flatMap((h) => [timeToMinutes(h.start), timeToMinutes(h.end)])),
    ...turnos.flatMap((t) => [timeToMinutes(formatInZone(t.startsAt, tz, "HH:mm")), timeToMinutes(formatInZone(t.endsAt, tz, "HH:mm"))]),
  ];
  const fromHour = Math.min(8, ...minutes.map((m) => Math.floor(m / 60)));
  const toHour = Math.min(24, Math.max(18, ...minutes.map((m) => Math.ceil(m / 60))));

  const active = turnos.filter((t) => t.status !== "cancelled");
  const showGrid = isTeam && !persona && people.length > 1;
  const canCreate = can(ctx, { appointment: ["create"] });
  const newHref = `/dashboard/agenda/new?fecha=${date}${persona ? `&persona=${persona.id}` : ""}`;

  return (
    <>
      <PageHeader
        help={{ section: "agenda", settings: ctx.settings, open: turnos.length === 0 }}
        title="Agenda"
        description="Tus turnos del día. Tocá un turno para confirmarlo, cancelarlo o marcar si vino."
        actions={
          canCreate && (
            <Link href={newHref} className={buttonVariants()}>
              <PlusIcon aria-hidden="true" /> Nuevo turno
            </Link>
          )
        }
      />

      {pending > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm text-warning-foreground">
          <HourglassIcon className="size-5 shrink-0" aria-hidden="true" />
          <span>
            <strong>
              {pending} turno{pending === 1 ? "" : "s"} {pending === 1 ? "espera" : "esperan"} tu confirmación.
            </strong>{" "}
            Aparecen con borde punteado.
          </span>
        </div>
      )}

      <AgendaDayNav
        date={date}
        today={today}
        hrefFor={{
          prev: hrefFor({ fecha: addDaysToDate(date, -1) }),
          next: hrefFor({ fecha: addDaysToDate(date, 1) }),
          today: hrefFor({ fecha: today }),
          base: hrefFor({}),
        }}
      />

      {isTeam && people.length > 1 && (
        <nav aria-label="Filtrar por persona" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <PersonChip href={hrefFor({ persona: null })} active={!persona}>
            Todos
          </PersonChip>
          {people.map((p) => (
            <PersonChip key={p.id} href={hrefFor({ persona: p.id })} active={persona?.id === p.id} name={p.name}>
              {p.name}
            </PersonChip>
          ))}
        </nav>
      )}

      {stays.length > 0 && <StaysBand stays={stays} date={date} timeZone={tz} />}

      {turnos.length === 0 && stays.length > 0 ? null : turnos.length === 0 ? (
        <EmptyState
          icon={people.some((p) => hoursFor(p.id).length > 0) ? CalendarPlusIcon : CalendarXIcon}
          title="No hay turnos este día"
          description={
            people.some((p) => hoursFor(p.id).length > 0)
              ? "Cuando alguien reserve desde tu link, el turno aparece acá. También podés agendar uno a mano."
              : "Este día no atendés según tu horario semanal."
          }
          action={
            canCreate && (
              <Link href={newHref} className={buttonVariants({ variant: "outline" })}>
                <PlusIcon aria-hidden="true" /> Agendar a mano
              </Link>
            )
          }
        />
      ) : (
        <>
          <p className="text-sm font-semibold text-muted-foreground">
            {active.length} turno{active.length === 1 ? "" : "s"}
            {turnos.length > active.length && ` · ${turnos.length - active.length} cancelado${turnos.length - active.length === 1 ? "" : "s"}`}
          </p>
          {showGrid && (
            <div className="hidden lg:block">
              <DayGrid
                columns={people.map((p) => ({ id: p.id, name: p.name, hours: hoursFor(p.id) }))}
                turnos={turnos}
                timeZone={tz}
                fromHour={fromHour}
                toHour={toHour}
              />
            </div>
          )}
          <div className={cn(showGrid && "lg:hidden")}>
            <AppointmentList turnos={turnos} timeZone={tz} showStaff={isTeam && !persona} />
          </div>
        </>
      )}
    </>
  );
}

function PersonChip({
  href,
  active,
  name,
  children,
}: {
  href: string;
  active: boolean;
  name?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full border py-1.5 text-sm font-semibold transition-colors",
        name ? "pr-4 pl-1.5" : "px-4",
        active ? "border-primary bg-primary-soft text-primary-soft-foreground" : "bg-card hover:bg-muted",
      )}
    >
      {name && <EntityAvatar name={name} size="sm" />}
      {children}
    </Link>
  );
}

/** Rentals that touch this day: who is staying and which night it is. */
function StaysBand({
  stays,
  date,
  timeZone,
}: {
  stays: { id: string; serviceName: string; clientName: string; startsAt: Date; endsAt: Date; status: string }[];
  date: string;
  timeZone: string;
}) {
  return (
    <section className="flex flex-col gap-2" aria-labelledby="stays-title">
      <h2 id="stays-title" className="flex items-center gap-2 text-sm font-bold tracking-wide text-muted-foreground uppercase">
        <BedDoubleIcon className="size-4" aria-hidden="true" /> Alquileres y estadías
      </h2>
      <ul className="flex flex-col gap-2">
        {stays.map((stay) => {
          const checkIn = formatInZone(stay.startsAt, timeZone, "yyyy-MM-dd");
          const checkOut = formatInZone(stay.endsAt, timeZone, "yyyy-MM-dd");
          const nights = Math.max(1, stayUnits("night", checkIn, checkOut));
          const night = stayUnits("night", checkIn, date) + 1;
          const moment =
            date === checkIn
              ? `Entra hoy ${formatInZone(stay.startsAt, timeZone, "HH:mm")}`
              : date === checkOut
                ? `Sale hoy ${formatInZone(stay.endsAt, timeZone, "HH:mm")}`
                : `Noche ${night} de ${nights}`;
          return (
            <li key={stay.id}>
              <Link
                href={`/dashboard/agenda/${stay.id}`}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-2xl border-l-4 border-primary bg-card p-4 shadow-soft hover:bg-primary-soft/30",
                  stay.status === "pending" && "border-dashed",
                  stay.status === "cancelled" && "opacity-50",
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold">{stay.serviceName}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {stay.clientName} · {formatInZone(stay.startsAt, timeZone, "d/MM")} → {formatInZone(stay.endsAt, timeZone, "d/MM")}
                  </span>
                </span>
                <Badge variant={date === checkIn || date === checkOut ? "warning" : "info"}>{moment}</Badge>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
