import {
  CalendarCheckIcon,
  CalendarPlusIcon,
  CircleXIcon,
  ClockIcon,
  HourglassIcon,
  MapPinIcon,
  MessageCircleIcon,
  UserRoundIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";

import { CancelBookingButton } from "@/components/booking/cancel-booking-button";
import { SaveLinkActions } from "@/components/booking/save-link-actions";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_LABELS, turnoTiming } from "@/lib/appointment-status";
import { hashManageToken } from "@/lib/booking";
import { getAppointmentByTokenHash } from "@/lib/data/appointments";
import { getPublicBusiness } from "@/lib/data/public";
import { redirectedSlug } from "@/lib/data/slugs";
import { formatInZone } from "@/lib/datetime";
import { googleCalendarUrl } from "@/lib/ics";
import { formatMoney } from "@/lib/money";
import { formatPhone, whatsappUrl } from "@/lib/phone";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tu turno", robots: { index: false, follow: false } };

export default function TurnoPage({ params }: PageProps<"/[slug]/turno/[token]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
      <Turno params={params} />
    </Suspense>
  );
}

async function Turno({ params }: { params: PageProps<"/[slug]/turno/[token]">["params"] }) {
  const { slug, token } = await params;
  const business = await getPublicBusiness(slug);
  if (!business) {
    const current = await redirectedSlug(slug);
    if (current) permanentRedirect(`/${current}/turno/${token}`);
    notFound();
  }
  const turno = await getAppointmentByTokenHash(business, hashManageToken(token));
  if (!turno) notFound();

  const { settings, organization } = business;
  const tz = settings.timezone;
  const { upcoming, canCancel } = turnoTiming(turno, settings.clientCancelNoticeHours);
  const isStay = turno.kind === "stay";
  const when = isStay
    ? `${formatInZone(turno.startsAt, tz, "EEE d/MM")} al ${formatInZone(turno.endsAt, tz, "EEE d/MM")}`
    : formatInZone(turno.startsAt, tz, "EEEE d 'de' MMMM");
  const time = isStay
    ? `Entrada ${formatInZone(turno.startsAt, tz, "HH:mm")} · salida ${formatInZone(turno.endsAt, tz, "HH:mm")}`
    : `${formatInZone(turno.startsAt, tz, "HH:mm")} a ${formatInZone(turno.endsAt, tz, "HH:mm")}`;
  const noun = isStay ? "Reserva" : "Turno";
  const summary = `${turno.serviceName}, ${organization.name}`;
  const selfLink = `Mi turno en ${organization.name}: ${when}, ${formatInZone(turno.startsAt, tz, "HH:mm")}.`;

  const hero =
    turno.status === "pending"
      ? {
          icon: HourglassIcon,
          title: `${noun} solicitad${isStay ? "a" : "o"}`,
          text: `El negocio lo tiene que confirmar. ${isStay ? "Las fechas ya quedaron reservadas" : "El horario ya quedó reservado"} para vos.`,
          tone: "bg-warning-soft text-warning-foreground",
        }
      : turno.status === "cancelled"
        ? { icon: CircleXIcon, title: `${noun} cancelad${isStay ? "a" : "o"}`, text: isStay ? "Estas fechas quedaron libres." : "Este horario quedó libre.", tone: "bg-muted text-muted-foreground" }
        : {
            icon: CalendarCheckIcon,
            title: turno.status === "confirmed" ? `¡${noun} confirmad${isStay ? "a" : "o"}!` : STATUS_LABELS[turno.status],
            text: upcoming ? "Te esperamos." : "",
            tone: "bg-success-soft text-success-foreground",
          };

  return (
    <>
      <section className="flex flex-col items-center gap-3 pt-4 text-center">
        <span className={cn("flex size-16 items-center justify-center rounded-full", hero.tone)}>
          <hero.icon className="size-8" aria-hidden="true" />
        </span>
        <h1 className="text-3xl font-extrabold">{hero.title}</h1>
        {hero.text && <p className="text-muted-foreground">{hero.text}</p>}
      </section>

      <section className="flex flex-col gap-4 rounded-3xl border bg-card p-6 shadow-soft">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-muted-foreground">{organization.name}</span>
          <span className="text-xl font-extrabold">{turno.serviceName}</span>
        </div>
        <ul className="flex flex-col gap-3 text-[15px]">
          <li className="flex items-center gap-3">
            <CalendarCheckIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <span className="font-semibold first-letter:uppercase">{when}</span>
          </li>
          <li className="flex items-center gap-3">
            <ClockIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <span className="tabular">{time}</span>
          </li>
          {settings.teamMode === "team" && turno.staffName && (
            <li className="flex items-center gap-3">
              <UserRoundIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
              Con {turno.staffName}
            </li>
          )}
          {settings.address && (
            <li className="flex items-center gap-3">
              <MapPinIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
              {settings.address}
            </li>
          )}
        </ul>
        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-sm text-muted-foreground">A nombre de {turno.bookedName ?? turno.clientName}</span>
          <span className="text-lg font-extrabold text-primary tabular">{formatMoney(turno.price, turno.currency)}</span>
        </div>
      </section>

      {upcoming && (
        <section className="flex flex-col gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <a href={`/${slug}/turno/${token}/calendar.ics`} className={buttonVariants({ variant: "outline", size: "lg" })}>
              <CalendarPlusIcon aria-hidden="true" /> Agregar al calendario
            </a>
            <a
              href={googleCalendarUrl({ start: turno.startsAt, end: turno.endsAt, summary, location: settings.address })}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Google Calendar
            </a>
          </div>
          <SaveLinkActions message={selfLink} />
          {canCancel ? (
            <CancelBookingButton slug={slug} token={token} />
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Para cancelar a esta altura, escribile al negocio.
            </p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2">
        {settings.publicPhone && (
          <a
            href={whatsappUrl(settings.publicPhone, `Hola, tengo un turno el ${when} a las ${formatInZone(turno.startsAt, tz, "HH:mm")}.`)}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "soft", size: "lg" }), "w-full")}
          >
            <MessageCircleIcon aria-hidden="true" /> Escribir al negocio ({formatPhone(settings.publicPhone)})
          </a>
        )}
        <Link href={`/${slug}`} className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "w-full")}>
          Reservar otro turno
        </Link>
      </section>
    </>
  );
}
