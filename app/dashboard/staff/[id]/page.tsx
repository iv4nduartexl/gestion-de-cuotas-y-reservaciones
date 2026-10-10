import { CalendarClockIcon, CalendarOffIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { setStaffArchivedAction, updateStaffAction } from "@/app/dashboard/staff/actions";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { StaffForm } from "@/components/staff/staff-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EntityAvatar } from "@/components/ui-kit/entity-avatar";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SectionCard } from "@/components/ui-kit/section-card";
import { parseId, requireProduct } from "@/lib/actions";
import { countUpcomingFor } from "@/lib/data/appointments";
import { getStaff, listOrganizationMembers } from "@/lib/data/staff";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Equipo" };

export default function StaffDetailPage({ params }: PageProps<"/dashboard/staff/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <StaffDetail params={params} />
    </Suspense>
  );
}

async function StaffDetail({ params }: { params: PageProps<"/dashboard/staff/[id]">["params"] }) {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "appointments");
  if (ctx.settings.teamMode !== "team") notFound();
  const id = parseId((await params).id);
  const person = id ? await getStaff(ctx, id) : null;
  if (!person) notFound();

  const members = await listOrganizationMembers(ctx);
  const archived = person.archivedAt !== null;
  const upcoming = archived ? 0 : await countUpcomingFor(ctx, { staffId: person.id });

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/staff", label: "Equipo" }}
        title={person.name}
        meta={archived && <Badge variant="neutral">Archivado</Badge>}
        actions={
          can(ctx, { staff: ["archive"] }) && (
            <ConfirmActionButton
              action={setStaffArchivedAction.bind(null, person.id, !archived)}
              label={archived ? "Restaurar" : "Archivar"}
              title={archived ? "¿Restaurar persona?" : "¿Archivar persona?"}
              description={
                archived
                  ? "Vuelve a poder recibir turnos."
                  : upcoming > 0
                    ? `Ya no va a recibir turnos nuevos. Tiene ${upcoming} turno${upcoming === 1 ? "" : "s"} próximo${upcoming === 1 ? "" : "s"}: no se cancelan, reasignalos o cancelalos desde la Agenda.`
                    : "Ya no va a poder recibir turnos nuevos. Su historial se conserva."
              }
              successMessage={archived ? "Restaurado" : "Archivado"}
            />
          )
        }
      />

      {!archived && (
        <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-soft sm:flex-row sm:items-center">
          <EntityAvatar name={person.name} size="lg" />
          <div className="flex flex-1 flex-col gap-1">
            <span className="font-bold">Horario y días libres</span>
            <span className="text-sm text-muted-foreground">
              Configurá cuándo atiende {person.name} y cargá sus vacaciones o ausencias.
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/schedule?persona=${person.id}`} className={buttonVariants()}>
              <CalendarClockIcon aria-hidden="true" /> Horario
            </Link>
            <Link
              href={`/dashboard/schedule?tab=dias-libres&persona=${person.id}`}
              className={buttonVariants({ variant: "outline" })}
            >
              <CalendarOffIcon aria-hidden="true" /> Días libres
            </Link>
          </div>
        </section>
      )}

      {can(ctx, { staff: ["update"] }) && (
        <SectionCard title="Datos">
          <StaffForm
            action={updateStaffAction.bind(null, person.id)}
            staff={person}
            members={members}
            submitLabel="Guardar cambios"
          />
        </SectionCard>
      )}
    </>
  );
}
