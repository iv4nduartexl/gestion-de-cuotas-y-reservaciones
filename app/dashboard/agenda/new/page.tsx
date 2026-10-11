import { BedDoubleIcon, CalendarClockIcon, ChevronRightIcon, ScissorsIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { NewAppointmentForm } from "@/components/agenda/new-appointment-form";
import { NewStayForm } from "@/components/agenda/new-stay-form";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { requireProduct } from "@/lib/actions";
import { getAvailability, listActiveStaffNames, listBookableServices } from "@/lib/booking";
import { vocabularyFor } from "@/lib/business-types";
import { getStaffForMember } from "@/lib/data/staff";
import { listStayServices } from "@/lib/data/stays";
import { DATE_PATTERN, todayInZone } from "@/lib/datetime";
import { getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Nuevo turno" };

export default function NewAppointmentPage({ searchParams }: PageProps<"/dashboard/agenda/new">) {
  return (
    <Suspense fallback={<ListSkeleton rows={5} />}>
      <NewAppointment searchParams={searchParams} />
    </Suspense>
  );
}

async function NewAppointment({ searchParams }: { searchParams: PageProps<"/dashboard/agenda/new">["searchParams"] }) {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "appointments");
  const params = await searchParams;
  const words = vocabularyFor(ctx.settings.businessType);
  const today = todayInZone(ctx.settings.timezone);
  const date = typeof params.fecha === "string" && DATE_PATTERN.test(params.fecha) && params.fecha >= today ? params.fecha : today;

  const isMember = ctx.role === "member";
  const [services, staff, own, stays] = await Promise.all([
    listBookableServices(ctx),
    listActiveStaffNames(ctx),
    isMember ? getStaffForMember(ctx, ctx.memberId) : Promise.resolve(null),
    // Rentals have no staff: members only book their own turnos.
    isMember ? Promise.resolve([]) : listStayServices(ctx),
  ]);
  const bookable = services.filter((s) => s.staffIds.length > 0);
  // Turno or rental? Ask only when the business has both.
  const kind = bookable.length === 0 ? "alquiler" : stays.length === 0 ? "turno" : params.tipo === "alquiler" || params.tipo === "turno" ? params.tipo : null;
  const header = (
    <PageHeader
      back={{ href: kind && bookable.length > 0 && stays.length > 0 ? "/dashboard/agenda/new" : "/dashboard/agenda", label: kind && bookable.length > 0 && stays.length > 0 ? "Volver" : "Agenda" }}
      title={kind === "alquiler" ? "Nuevo alquiler" : kind === "turno" ? "Nuevo turno" : "¿Qué vas a agendar?"}
      description={
        kind === "alquiler"
          ? "Para quien te escribe o te llama. Queda confirmado."
          : kind === "turno"
            ? "Para quien te llama o llega sin reserva. Queda confirmado."
            : "Elegí una opción para seguir."
      }
    />
  );

  if (bookable.length === 0 && stays.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={ScissorsIcon}
          title={`Primero cargá tus ${words.service.many}`}
          description="Cada turno o alquiler es de un servicio, con su duración y precio."
          action={
            <Link href="/dashboard/services/new" className={buttonVariants()}>
              Agregar {words.service.one}
            </Link>
          }
        />
      </>
    );
  }

  if (kind === null) {
    const choices = [
      { tipo: "turno", icon: CalendarClockIcon, title: "Un turno", text: "Una cita de un rato, con día y hora." },
      { tipo: "alquiler", icon: BedDoubleIcon, title: "Un alquiler", text: "Por noches o por días, con entrada y salida." },
    ];
    return (
      <>
        {header}
        <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
          {choices.map(({ tipo, icon: Icon, title, text }) => (
            <Link
              key={tipo}
              href={`/dashboard/agenda/new?tipo=${tipo}${typeof params.fecha === "string" ? `&fecha=${params.fecha}` : ""}`}
              className="flex items-center gap-3 rounded-2xl border-2 bg-card p-4 transition-colors hover:border-primary/40"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="font-bold">{title}</span>
                <span className="text-sm text-muted-foreground">{text}</span>
              </span>
              <ChevronRightIcon className="size-5 text-muted-foreground" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </>
    );
  }

  if (kind === "alquiler") {
    return (
      <>
        {header}
        <NewStayForm stays={stays} timeZone={ctx.settings.timezone} clientNoun={words.client.one} />
      </>
    );
  }

  const lockedStaffId = isMember ? (own?.id ?? "none") : null;
  const initialStaffId = lockedStaffId ?? (typeof params.persona === "string" ? params.persona : null);
  // Preload free times for the default service and day.
  const initialSlots = (await getAvailability(ctx, bookable[0], initialStaffId ?? "any", date, 1, { online: false }))[0].slots.map(
    ({ start, time }) => ({ start, time }),
  );

  return (
    <>
      {header}
      <NewAppointmentForm
        services={bookable}
        staff={staff}
        showStaff={ctx.settings.teamMode === "team"}
        lockedStaffId={lockedStaffId}
        initialDate={date}
        initialStaffId={initialStaffId}
        initialSlots={initialSlots}
        clientNoun={words.client.one}
      />
    </>
  );
}
