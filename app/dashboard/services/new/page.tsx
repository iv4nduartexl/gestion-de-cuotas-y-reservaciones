import type { Metadata } from "next";
import { Suspense } from "react";

import { createServiceAction } from "@/app/dashboard/services/actions";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { ServiceForm } from "@/components/services/service-form";
import { PageHeader } from "@/components/ui-kit/page-header";
import { requireProduct } from "@/lib/actions";
import { capitalize, vocabularyFor } from "@/lib/business-types";
import { listStaff } from "@/lib/data/staff";
import { currencyPrefix } from "@/lib/money";
import { getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Nuevo servicio" };

export default function NewServicePage() {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <NewService />
    </Suspense>
  );
}

async function NewService() {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "appointments");
  const words = vocabularyFor(ctx.settings.businessType);
  const staffOptions = (await listStaff(ctx)).map(({ id, name }) => ({ id, name }));
  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/services", label: capitalize(words.service.many) }}
        title={`Agregar ${words.service.one}`}
        description="Podés cambiar el precio o la duración cuando quieras."
      />
      <ServiceForm
        action={createServiceAction}
        staffOptions={staffOptions}
        showStaff={ctx.settings.teamMode === "team"}
        staffNoun={words.staff.many}
        serviceNoun={words.service.one}
        currencyPrefix={currencyPrefix(ctx.settings.currency)}
        submitLabel={`Guardar ${words.service.one}`}
      />
    </>
  );
}
