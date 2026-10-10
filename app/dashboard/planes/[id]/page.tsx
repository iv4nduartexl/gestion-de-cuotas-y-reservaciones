import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { setPlanArchivedAction, updatePlanAction } from "@/app/dashboard/planes/actions";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { PlanForm } from "@/components/memberships/plan-form";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui-kit/page-header";
import { parseId, requireProduct } from "@/lib/actions";
import { getPlan } from "@/lib/data/plans";
import { intervalLabel } from "@/lib/membership-constants";
import { currencyPrefix, formatAmountInput, formatMoney } from "@/lib/money";
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
      {can(ctx, { plan: ["update"] }) && (
        <PlanForm
          action={updatePlanAction.bind(null, plan.id)}
          plan={{ ...plan, priceInput: formatAmountInput(plan.price, plan.currency) }}
          currencyPrefix={currencyPrefix(plan.currency)}
          submitLabel="Guardar cambios"
        />
      )}
    </>
  );
}
