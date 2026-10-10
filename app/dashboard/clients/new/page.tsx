import type { Metadata } from "next";
import { Suspense } from "react";

import { createClientAction } from "@/app/dashboard/clients/actions";
import { ClientForm } from "@/components/clients/client-form";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { PageHeader } from "@/components/ui-kit/page-header";
import { capitalize, vocabularyFor } from "@/lib/business-types";
import { getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default function NewClientPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <NewClient />
    </Suspense>
  );
}

async function NewClient() {
  const ctx = await getTenantContextOrRedirect();
  const words = vocabularyFor(ctx.settings.businessType).client;
  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/clients", label: capitalize(words.many) }}
        title={`Agregar ${words.one}`}
        description="Solo el nombre y el teléfono son obligatorios."
      />
      <ClientForm action={createClientAction} submitLabel={`Guardar ${words.one}`} noun={words.one} />
    </>
  );
}
