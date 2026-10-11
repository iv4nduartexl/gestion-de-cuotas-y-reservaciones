import type { Metadata } from "next";
import { Suspense } from "react";

import { serviceWizardProps } from "@/app/dashboard/services/wizard-props";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { ServiceWizard } from "@/components/services/service-wizard";
import { PageHeader } from "@/components/ui-kit/page-header";
import { requireProduct } from "@/lib/actions";
import { capitalize, vocabularyFor } from "@/lib/business-types";
import { NEW_SERVICE_VALUES } from "@/lib/wizard-values";
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
  const props = await serviceWizardProps(ctx);
  return (
    <>
      <PageHeader back={{ href: "/dashboard/services", label: capitalize(words.service.many) }} title={`Agregar ${words.service.one}`} />
      <ServiceWizard initial={NEW_SERVICE_VALUES(props.staffOptions.map((option) => option.id))} {...props} />
    </>
  );
}
