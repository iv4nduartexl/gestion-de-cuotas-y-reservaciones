import { MailIcon, PhoneIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  setClientArchivedAction,
  updateClientAction,
} from "@/app/dashboard/clients/actions";
import { ClientForm } from "@/components/clients/client-form";
import { MembershipSection } from "@/components/memberships/membership-section";
import { WhatsAppButton } from "@/components/clients/whatsapp-button";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SectionCard } from "@/components/ui-kit/section-card";
import { EntityAvatar } from "@/components/ui-kit/entity-avatar";
import { PageHeader } from "@/components/ui-kit/page-header";
import { parseId } from "@/lib/actions";
import { STATUS_BADGE, STATUS_LABELS } from "@/lib/appointment-status";
import { capitalize, vocabularyFor } from "@/lib/business-types";
import { listClientAppointments } from "@/lib/data/appointments";
import { getClient } from "@/lib/data/clients";
import { formatInZone, todayInZone } from "@/lib/datetime";
import { listClientCharges, syncCharges } from "@/lib/data/charges";
import { listClientEnrollments } from "@/lib/data/enrollments";
import { listPlans } from "@/lib/data/plans";
import { formatCi } from "@/lib/document";
import { formatPhone } from "@/lib/phone";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Cliente" };

export default function ClientPage({ params }: PageProps<"/dashboard/clients/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <ClientDetail params={params} />
    </Suspense>
  );
}

async function ClientDetail({
  params,
}: {
  params: PageProps<"/dashboard/clients/[id]">["params"];
}) {
  const ctx = await getTenantContextOrRedirect();
  const words = vocabularyFor(ctx.settings.businessType).client;
  const id = parseId((await params).id);
  const client = id ? await getClient(ctx, id) : null;
  if (!client) notFound();

  const archived = client.archivedAt !== null;
  const turnos = ctx.settings.appointmentsEnabled ? await listClientAppointments(ctx, client.id) : [];
  const today = todayInZone(ctx.settings.timezone);
  if (ctx.settings.membershipsEnabled) await syncCharges(ctx, { today });
  const [enrollmentRows, chargeRows, planRows] = ctx.settings.membershipsEnabled
    ? await Promise.all([listClientEnrollments(ctx, client.id), listClientCharges(ctx, client.id, today), listPlans(ctx)])
    : [[], [], []];
  return (
    <>
      <PageHeader back={{ href: "/dashboard/clients", label: capitalize(words.many) }} title={client.name} />

      <section className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-soft sm:flex-row sm:items-center sm:p-6">
        <EntityAvatar name={client.name} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl font-bold">{client.name}</span>
            {archived && <Badge variant="neutral">Archivado</Badge>}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 tabular">
              <PhoneIcon className="size-4" aria-hidden="true" />
              {formatPhone(client.phone)}
            </span>
            {client.documentNumber && <span className="tabular">C.I. {formatCi(client.documentNumber)}</span>}
            {client.email && (
              <span className="inline-flex items-center gap-1.5">
                <MailIcon className="size-4" aria-hidden="true" />
                {client.email}
                {client.emailOptOutAt && (
                  <Badge variant="neutral" title="Se dio de baja desde el link del correo. Sus recordatorios van a la bandeja de WhatsApp.">
                    No quiere recibir correos
                  </Badge>
                )}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <WhatsAppButton phone={client.phone} name={client.name} withLabel />
          {can(ctx, { client: ["archive"] }) && (
            <ConfirmActionButton
              action={setClientArchivedAction.bind(null, client.id, !archived)}
              label={archived ? "Restaurar" : "Archivar"}
              title={archived ? `¿Restaurar ${words.one}?` : `¿Archivar ${words.one}?`}
              description={
                archived
                  ? `Vuelve a aparecer en tu lista de ${words.many}. Si tenía membresías, siguen pausadas: reanudalas desde acá cuando vuelva.`
                  : `Deja de aparecer en tu lista, pero no se borra nada.${ctx.settings.membershipsEnabled ? " Sus membresías se pausan: no se generan más cuotas ni recordatorios de pago." : ""} Podés restaurarlo cuando quieras.`
              }
              successMessage={archived ? "Restaurado" : "Archivado"}
            />
          )}
        </div>
      </section>

      {ctx.settings.membershipsEnabled && (
        <MembershipSection
          clientId={client.id}
          clientName={client.name}
          enrollments={enrollmentRows}
          charges={chargeRows}
          plans={planRows}
          today={today}
          currency={ctx.settings.currency}
          canEnroll={can(ctx, { enrollment: ["create"] }) && !archived}
          canManage={can(ctx, { enrollment: ["update"] })}
          canPay={can(ctx, { payment: ["create"] })}
        />
      )}

      {ctx.settings.appointmentsEnabled && (
        <SectionCard
          title="Turnos"
          description={turnos.length === 0 ? `Todavía no tiene turnos.` : `Los próximos y su historial.`}
          actions={
            can(ctx, { appointment: ["create"] }) && (
              <Link href="/dashboard/agenda/new" className={buttonVariants({ variant: "soft", size: "sm" })}>
                <PlusIcon aria-hidden="true" /> Nuevo turno
              </Link>
            )
          }
        >
          {turnos.length > 0 && (
            <ul className="flex flex-col divide-y">
              {turnos.map((turno) => (
                <li key={turno.id}>
                  <Link href={`/dashboard/agenda/${turno.id}`} className="flex items-center gap-3 py-3 hover:text-primary">
                    <span className="flex w-24 shrink-0 flex-col leading-tight">
                      <span className="font-bold tabular">{formatInZone(turno.startsAt, ctx.settings.timezone, "dd/MM/yyyy")}</span>
                      <span className="text-xs text-muted-foreground tabular">{formatInZone(turno.startsAt, ctx.settings.timezone, "HH:mm")}</span>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{turno.serviceName}</span>
                    <Badge variant={STATUS_BADGE[turno.status]}>{STATUS_LABELS[turno.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {can(ctx, { client: ["update"] }) ? (
        <ClientForm
          action={updateClientAction.bind(null, client.id)}
          client={{
            ...client,
            phone: formatPhone(client.phone),
            documentNumber: client.documentNumber ? formatCi(client.documentNumber) : null,
          }}
          submitLabel="Guardar cambios"
          noun={words.one}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No tenés permiso para editar {words.many}.</p>
      )}
    </>
  );
}
