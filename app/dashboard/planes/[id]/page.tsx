import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { setPlanArchivedAction } from "@/app/dashboard/planes/actions";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SummaryCard } from "@/components/wizard/summary-card";
import { parseId, requireProduct } from "@/lib/actions";
import { getPlan } from "@/lib/data/plans";
import { intervalLabel } from "@/lib/membership-constants";
import { formatMoney } from "@/lib/money";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Plan" };

export default function PlanPage({ params }: PageProps<"/dashboard/planes/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={3} />}>
      <PlanDetail params={params} />
    </Suspense>
  );
}

async function PlanDetail({ params }: { params: PageProps<"/dashboard/planes/[id]">["params"] }) {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "memberships");
  const id = parseId((await params).id);
  const plan = id ? await getPlan(ctx, id) : null;
  if (!plan) notFound();
  const archived = plan.archivedAt !== null;
  const editable = can(ctx, { plan: ["update"] }) && !archived;
  const edit = (step: string) => (editable ? `/dashboard/planes/${plan.id}/editar?paso=${step}` : undefined);

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/planes", label: "Planes" }}
        title={plan.name}
        meta={archived && <Badge variant="neutral">Archivado</Badge>}
        description={`${formatMoney(plan.price, plan.currency)} ${intervalLabel(plan.intervalUnit, plan.intervalCount)}`}
        actions={
          can(ctx, { plan: ["archive"] }) && (
            <ConfirmActionButton
              action={setPlanArchivedAction.bind(null, plan.id, !archived)}
              label={archived ? "Restaurar" : "Archivar"}
              title={archived ? "¿Restaurar plan?" : "¿Archivar plan?"}
              description={archived ? "Se va a poder usar para nuevas inscripciones." : "No se va a poder usar para nuevas inscripciones. Las inscripciones actuales siguen igual."}
              successMessage={archived ? "Restaurado" : "Archivado"}
            />
          )
        }
      />
      <SummaryCard
        rows={[
          { label: "Nombre", value: <span className="flex flex-col">{plan.name}{plan.description && <span className="text-sm font-normal text-muted-foreground">{plan.description}</span>}</span>, href: edit("nombre") },
          { label: "Precio", value: formatMoney(plan.price, plan.currency), href: edit("precio") },
          { label: "Cada cuánto", value: `Se cobra ${intervalLabel(plan.intervalUnit, plan.intervalCount)}`, href: edit("frecuencia") },
          { label: "Cuándo se paga", value: plan.billingTiming === "arrears" ? "A período vencido (al final)" : "Por adelantado (al inicio)", href: edit("cobro") },
        ]}
      />
      {editable && <p className="text-sm text-muted-foreground">Un nuevo precio se aplica a las próximas inscripciones; las actuales mantienen el suyo.</p>}
    </>
  );
}
