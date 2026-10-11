import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  changeAppointmentAction,
  changeAppointmentClientAction,
  changeAppointmentPriceAction,
  changeStayDatesAction,
} from "@/app/dashboard/agenda/actions";
import { ChangeClientForm, ChangePriceForm, ChangeStayForm } from "@/components/agenda/change-forms";
import { NewAppointmentForm } from "@/components/agenda/new-appointment-form";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { PageHeader } from "@/components/ui-kit/page-header";
import { parseId, requireProduct } from "@/lib/actions";
import { ACTIVE_STATUSES } from "@/lib/appointment-status";
import { getAvailability, listActiveStaffNames, listBookableServices } from "@/lib/booking";
import { vocabularyFor } from "@/lib/business-types";
import { getAppointment } from "@/lib/data/appointments";
import { getStaffForMember } from "@/lib/data/staff";
import { getStayService } from "@/lib/data/stays";
import { formatInZone } from "@/lib/datetime";
import { currencyPrefix } from "@/lib/money";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Cambiar turno" };

const WHAT = ["horario", "fechas", "precio", "cliente"] as const;
type What = (typeof WHAT)[number];

export default function EditAppointmentPage({ params, searchParams }: PageProps<"/dashboard/agenda/[id]/editar">) {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <EditAppointment params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EditAppointment({
  params,
  searchParams,
}: {
  params: PageProps<"/dashboard/agenda/[id]/editar">["params"];
  searchParams: PageProps<"/dashboard/agenda/[id]/editar">["searchParams"];
}) {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "appointments");
  const id = parseId((await params).id);
  const turno = id ? await getAppointment(ctx, id) : null;
  if (!turno) notFound();
  const own = ctx.role === "member" ? await getStaffForMember(ctx, ctx.memberId) : null;
  if (!can(ctx, { appointment: ["update"] }) || (ctx.role === "member" && own?.id !== turno.staffId)) notFound();

  const requested = (await searchParams).que;
  const what: What = WHAT.find((w) => w === requested) ?? (turno.kind === "stay" ? "fechas" : "horario");
  const isStay = turno.kind === "stay";
  const active = (ACTIVE_STATUSES as readonly string[]).includes(turno.status);
  const tz = ctx.settings.timezone;
  const back = { href: `/dashboard/agenda/${turno.id}`, label: isStay ? "Reserva" : "Turno" };
  const words = vocabularyFor(ctx.settings.businessType);
  const header = (title: string) => <PageHeader back={back} title={title} description={`${isStay ? "Reserva" : "Turno"} de ${turno.clientName}`} />;

  // Moving only makes sense while the turno is still ahead (pending/confirmed).
  if ((what === "horario" || what === "fechas") && !active) notFound();
  if (what === "precio" && turno.status === "cancelled") notFound();

  if (what === "precio") {
    return (
      <>
        {header("Cambiar precio")}
        <ChangePriceForm
          action={changeAppointmentPriceAction.bind(null, turno.id)}
          price={turno.price}
          currency={turno.currency}
          currencyPrefix={currencyPrefix(turno.currency)}
        />
      </>
    );
  }

  if (what === "cliente") {
    return (
      <>
        {header(`Cambiar ${words.client.one}`)}
        <ChangeClientForm action={changeAppointmentClientAction.bind(null, turno.id)} clientNoun={words.client.one} currentName={turno.clientName} />
      </>
    );
  }

  if (isStay) {
    if (ctx.role === "member") notFound();
    const stay = await getStayService(ctx, turno.serviceId);
    if (!stay) notFound();
    return (
      <>
        {header("Cambiar fechas")}
        <ChangeStayForm
          action={changeStayDatesAction.bind(null, turno.id)}
          appointmentId={turno.id}
          stay={stay}
          timeZone={tz}
          current={{ checkIn: formatInZone(turno.startsAt, tz, "yyyy-MM-dd"), checkOut: formatInZone(turno.endsAt, tz, "yyyy-MM-dd") }}
          currentPrice={turno.price}
        />
      </>
    );
  }

  const [services, staff] = await Promise.all([listBookableServices(ctx), listActiveStaffNames(ctx)]);
  const bookable = services.filter((s) => s.staffIds.length > 0 || s.id === turno.serviceId);
  const service = bookable.find((s) => s.id === turno.serviceId) ?? bookable[0];
  if (!service) notFound();
  const date = formatInZone(turno.startsAt, tz, "yyyy-MM-dd");
  const staffChoice = turno.staffId ?? "any";
  const [day] = await getAvailability(ctx, service, staffChoice, date, 1, { online: false, excludeId: turno.id });

  return (
    <>
      {header("Cambiar día y hora")}
      <NewAppointmentForm
        services={bookable}
        staff={staff}
        showStaff={ctx.settings.teamMode === "team"}
        lockedStaffId={ctx.role === "member" ? (own?.id ?? "none") : null}
        initialDate={date}
        initialStaffId={staffChoice}
        initialServiceId={service.id}
        initialSlots={day.slots.map(({ start, time }) => ({ start, time }))}
        clientNoun={words.client.one}
        change={{ appointmentId: turno.id, action: changeAppointmentAction.bind(null, turno.id), currentStart: turno.startsAt.toISOString() }}
      />
    </>
  );
}
