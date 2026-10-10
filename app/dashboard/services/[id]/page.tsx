import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  setServiceArchivedAction,
  updateServiceAction,
} from "@/app/dashboard/services/actions";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { ServiceForm } from "@/components/services/service-form";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui-kit/page-header";
import { parseId, requireProduct } from "@/lib/actions";
import { capitalize, vocabularyFor } from "@/lib/business-types";
import { getService } from "@/lib/data/services";
import { listStaff } from "@/lib/data/staff";
import { formatDuration } from "@/lib/datetime";
import { currencyPrefix, formatAmountInput, formatMoney } from "@/lib/money";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Servicio" };

export default function ServicePage({ params }: PageProps<"/dashboard/services/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <ServiceDetail params={params} />
    </Suspense>
  );
}

async function ServiceDetail({
  params,
}: {
  params: PageProps<"/dashboard/services/[id]">["params"];
}) {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "appointments");
  const words = vocabularyFor(ctx.settings.businessType);
  const id = parseId((await params).id);
  const service = id ? await getService(ctx, id) : null;
  if (!service) notFound();

  const staffOptions = (await listStaff(ctx)).map(({ id, name }) => ({ id, name }));
  const archived = service.archivedAt !== null;

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/services", label: capitalize(words.service.many) }}
        title={service.name}
        meta={archived && <Badge variant="neutral">Archivado</Badge>}
        description={
          <span className="tabular">
            {formatDuration(service.durationMinutes)} · {formatMoney(service.price, service.currency)}
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
                  : "Deja de aparecer para reservar. Los turnos que ya existen se conservan."
              }
              successMessage={archived ? "Restaurado" : "Archivado"}
            />
          )
        }
      />
      {can(ctx, { service: ["update"] }) ? (
        <ServiceForm
          action={updateServiceAction.bind(null, service.id)}
          service={{
            ...service,
            priceInput: formatAmountInput(service.price, service.currency),
            // Archived staff can't be assigned; drop them from the selection.
            staffIds: service.staffIds.filter((staffId) => staffOptions.some((option) => option.id === staffId)),
          }}
          staffOptions={staffOptions}
          showStaff={ctx.settings.teamMode === "team"}
          staffNoun={words.staff.many}
          serviceNoun={words.service.one}
          currencyPrefix={currencyPrefix(service.currency)}
          submitLabel="Guardar cambios"
        />
      ) : (
        <p className="text-sm text-muted-foreground">No tenés permiso para editar {words.service.many}.</p>
      )}
    </>
  );
}
