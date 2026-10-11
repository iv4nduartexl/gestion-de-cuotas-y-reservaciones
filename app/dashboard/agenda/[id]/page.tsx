import { CalendarIcon, ClockIcon, GlobeIcon, MessageSquareIcon, ScissorsIcon, UserRoundIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { InternalNotesForm } from "@/components/agenda/internal-notes-form";
import { StatusActions } from "@/components/agenda/status-actions";
import { WhatsAppButton } from "@/components/clients/whatsapp-button";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { Badge } from "@/components/ui/badge";
import { EntityAvatar } from "@/components/ui-kit/entity-avatar";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SectionCard } from "@/components/ui-kit/section-card";
import { parseId, requireProduct } from "@/lib/actions";
import { STATUS_BADGE, STATUS_LABELS } from "@/lib/appointment-status";
import { getAppointment } from "@/lib/data/appointments";
import { getStaffForMember } from "@/lib/data/staff";
import { stayUnits } from "@/lib/stays";
import { formatInZone, todayInZone } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Turno" };

export default function AppointmentPage({ params }: PageProps<"/dashboard/agenda/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <AppointmentDetail params={params} />
    </Suspense>
  );
}

async function AppointmentDetail({ params }: { params: PageProps<"/dashboard/agenda/[id]">["params"] }) {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "appointments");
  const id = parseId((await params).id);
  const turno = id ? await getAppointment(ctx, id) : null;
  if (!turno) notFound();

  const tz = ctx.settings.timezone;
  const date = formatInZone(turno.startsAt, tz, "yyyy-MM-dd");
  const own = ctx.role === "member" ? await getStaffForMember(ctx, ctx.memberId) : null;
  const canManage = can(ctx, { appointment: ["update"] }) && (ctx.role !== "member" || own?.id === turno.staffId);
  const backHref = date === todayInZone(tz) ? "/dashboard/agenda" : `/dashboard/agenda?fecha=${date}`;

  const isStay = turno.kind === "stay";
  const nights = isStay ? stayUnits("night", date, formatInZone(turno.endsAt, tz, "yyyy-MM-dd")) : 0;
  const rows: { icon: React.ReactNode; label: string; value: React.ReactNode }[] = isStay
    ? [
        { icon: <CalendarIcon />, label: "Entrada", value: <span className="inline-block tabular first-letter:uppercase">{formatInZone(turno.startsAt, tz, "EEEE d 'de' MMMM · HH:mm")}</span> },
        { icon: <CalendarIcon />, label: "Salida", value: <span className="inline-block tabular first-letter:uppercase">{formatInZone(turno.endsAt, tz, "EEEE d 'de' MMMM · HH:mm")}</span> },
        { icon: <ClockIcon />, label: "Estadía", value: `${nights} ${nights === 1 ? "noche" : "noches"}` },
        { icon: <ScissorsIcon />, label: "Alquiler", value: `${turno.serviceName} · ${formatMoney(turno.price, turno.currency)}` },
      ]
    : [
        { icon: <CalendarIcon />, label: "Día", value: <span className="inline-block first-letter:uppercase">{formatInZone(turno.startsAt, tz, "EEEE d 'de' MMMM yyyy")}</span> },
        { icon: <ClockIcon />, label: "Hora", value: <span className="tabular">{formatInZone(turno.startsAt, tz, "HH:mm")} a {formatInZone(turno.endsAt, tz, "HH:mm")}</span> },
        { icon: <ScissorsIcon />, label: "Servicio", value: `${turno.serviceName} · ${formatMoney(turno.price, turno.currency)}` },
        ...(ctx.settings.teamMode === "team" ? [{ icon: <UserRoundIcon />, label: "Con", value: turno.staffName }] : []),
      ];
  rows.push({
    icon: <GlobeIcon />,
    label: "Origen",
    value: turno.source === "online" ? "Reservado online por el cliente" : "Agendado desde el panel",
  });

  return (
    <>
      <PageHeader
        back={{ href: backHref, label: "Agenda" }}
        title={`${isStay ? "Reserva" : "Turno"} de ${turno.clientName}`}
        meta={<Badge variant={STATUS_BADGE[turno.status]}>{STATUS_LABELS[turno.status]}</Badge>}
      />

      {turno.status === "pending" && canManage && (
        <p className="rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm text-warning-foreground">
          Este turno se reservó online y espera tu confirmación. El horario ya está apartado.
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          <SectionCard title="Detalle">
            <dl className="flex flex-col gap-4">
              {rows.map((row) => (
                <div key={row.label} className="flex items-start gap-3">
                  <span className="mt-0.5 text-primary [&_svg]:size-5" aria-hidden="true">
                    {row.icon}
                  </span>
                  <div className="flex flex-col">
                    <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{row.label}</dt>
                    <dd className="font-semibold">{row.value}</dd>
                  </div>
                </div>
              ))}
              {turno.notes && (
                <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
                  <MessageSquareIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div className="flex flex-col">
                    <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Comentario del cliente</dt>
                    <dd>{turno.notes}</dd>
                  </div>
                </div>
              )}
              {turno.status === "cancelled" && (
                <p className="text-sm text-muted-foreground">
                  Cancelado por {turno.cancelledBy === "client" ? "el cliente" : "el negocio"}
                  {turno.cancellationReason ? `: ${turno.cancellationReason}` : "."}
                </p>
              )}
            </dl>
            {canManage && <StatusActions id={turno.id} status={turno.status} />}
          </SectionCard>
          {canManage && (
            <SectionCard title="Notas" description="Para recordar algo de este turno.">
              <InternalNotesForm id={turno.id} notes={turno.internalNotes} />
            </SectionCard>
          )}
        </div>

        <SectionCard title="Cliente">
          <Link href={`/dashboard/clients/${turno.clientId}`} className="flex items-center gap-3 hover:text-primary">
            <EntityAvatar name={turno.clientName} />
            <span className="flex flex-col">
              <span className="font-bold">{turno.clientName}</span>
              <span className="text-sm text-muted-foreground tabular">{formatPhone(turno.clientPhone)}</span>
            </span>
          </Link>
          {turno.bookedName && !sameName(turno.bookedName, turno.clientName) && (
            <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning-foreground">
              Reservó online como <strong>“{turno.bookedName}”</strong>, con el teléfono de {turno.clientName}. Confirmá con quién es el turno.
            </p>
          )}
          <WhatsAppButton phone={turno.clientPhone} name={turno.clientName} withLabel className="w-fit" />
        </SectionCard>
      </div>
    </>
  );
}

/** Loose name comparison: case, accents and extra spaces don't count. */
function sameName(a: string, b: string) {
  const normalize = (value: string) =>
    value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
  return normalize(a) === normalize(b);
}
