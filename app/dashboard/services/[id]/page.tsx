import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { setServiceArchivedAction } from "@/app/dashboard/services/actions";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { FormMessage } from "@/components/forms/form-message";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SummaryCard } from "@/components/wizard/summary-card";
import { parseId, requireProduct } from "@/lib/actions";
import { capitalize, vocabularyFor } from "@/lib/business-types";
import { countUpcomingFor } from "@/lib/data/appointments";
import { findServiceProblems, getService } from "@/lib/data/services";
import { listStaff } from "@/lib/data/staff";
import { formatDuration } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { STAY_UNIT_WORDS } from "@/lib/service-constants";
import { priceSuffix, serviceSummary } from "@/lib/service-format";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Servicio" };

export default function ServicePage({ params }: PageProps<"/dashboard/services/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <ServiceDetail params={params} />
    </Suspense>
  );
}

async function ServiceDetail({ params }: { params: PageProps<"/dashboard/services/[id]">["params"] }) {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "appointments");
  const words = vocabularyFor(ctx.settings.businessType);
  const id = parseId((await params).id);
  const service = id ? await getService(ctx, id) : null;
  if (!service) notFound();

  const archived = service.archivedAt !== null;
  const [problems, upcoming, staffRows] = await Promise.all([
    archived ? Promise.resolve(new Map<string, string>()) : findServiceProblems(ctx),
    archived ? Promise.resolve(0) : countUpcomingFor(ctx, { serviceId: service.id }),
    listStaff(ctx),
  ]);
  const problem = problems.get(service.id);
  const editable = can(ctx, { service: ["update"] }) && !archived;
  const edit = (step: string) => (editable ? `/dashboard/services/${service.id}/editar?paso=${step}` : undefined);
  const money = (amount: number | null) => (amount === null ? "—" : formatMoney(amount, service.currency));
  const isStay = service.bookingType === "stay";
  const unit = service.stayUnit ?? "night";

  const rows = [
    { label: "Cómo se reserva", value: isStay ? "Por días (alquiler)" : "Por horario (turnos)", href: edit("tipo") },
    { label: "Nombre", value: <span className="flex flex-col">{service.name}{service.description && <span className="text-sm font-normal text-muted-foreground">{service.description}</span>}</span>, href: edit("nombre") },
    ...(isStay
      ? [
          { label: "Se cobra por", value: `${STAY_UNIT_WORDS[unit][0]}`, href: edit("cobro") },
          { label: "Entrada y salida", value: `Entra desde las ${service.checkInTime} · sale hasta las ${service.checkOutTime}`, href: edit("horas") },
          {
            label: "Estadía",
            value: `Mínimo ${service.minStay} ${STAY_UNIT_WORDS[unit][service.minStay === 1 ? 0 : 1]}${service.maxStay ? ` · máximo ${service.maxStay}` : " · sin máximo"}`,
            href: edit("estadia"),
          },
          {
            label: "Precio",
            value: `${money(service.price)} por ${STAY_UNIT_WORDS[unit][0]}${service.weeklyPrice ? ` · ${money(service.weeklyPrice)} por semana` : ""}${service.monthlyPrice ? ` · ${money(service.monthlyPrice)} por mes` : ""}`,
            href: edit("precio"),
          },
        ]
      : [
          { label: "Duración", value: formatDuration(service.durationMinutes ?? 0), href: edit("duracion") },
          { label: "Precio", value: money(service.price), href: edit("precio") },
          ...(ctx.settings.teamMode === "team"
            ? [
                {
                  label: "Lo hacen",
                  value: staffRows.filter((person) => service.staffIds.includes(person.id)).map((person) => person.name).join(", ") || "Nadie todavía",
                  href: edit("quien"),
                },
              ]
            : []),
        ]),
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/services", label: capitalize(words.service.many) }}
        title={service.name}
        meta={archived ? <Badge variant="neutral">Archivado</Badge> : problem ? <Badge variant="coral">Necesita arreglo</Badge> : null}
        description={
          <span className="tabular">
            {serviceSummary(service)} · {formatMoney(service.price, service.currency)}
            {priceSuffix(service)}
          </span>
        }
        actions={
          can(ctx, { service: ["archive"] }) && (
            <ConfirmActionButton
              action={setServiceArchivedAction.bind(null, service.id, !archived)}
              label={archived ? "Restaurar" : "Archivar"}
              title={archived ? `¿Restaurar ${words.service.one}?` : `¿Archivar ${words.service.one}?`}
              description={
                archived
                  ? "Se va a poder reservar de nuevo."
                  : upcoming > 0
                    ? `Deja de aparecer para reservar. Tiene ${upcoming} reserva${upcoming === 1 ? "" : "s"} próxima${upcoming === 1 ? "" : "s"}: no se cancelan, revisalas en la Agenda.`
                    : "Deja de aparecer para reservar. Las reservas que ya existen se conservan."
              }
              successMessage={archived ? "Restaurado" : "Archivado"}
            />
          )
        }
      />
      {problem && (
        <FormMessage type="warning">
          <strong>Así no se puede reservar:</strong> {problem} Mientras tanto no aparece en tu página de reservas. Tocá “Cambiar” en la línea que corresponde.
        </FormMessage>
      )}
      <SummaryCard rows={rows} />
    </>
  );
}
