import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { serviceWizardProps } from "@/app/dashboard/services/wizard-props";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { ServiceWizard } from "@/components/services/service-wizard";
import { PageHeader } from "@/components/ui-kit/page-header";
import { parseId, requireProduct } from "@/lib/actions";
import { getService } from "@/lib/data/services";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Cambiar servicio" };

const STEPS = ["tipo", "nombre", "duracion", "cobro", "horas", "estadia", "precio", "quien"];

export default function EditServicePage({ params, searchParams }: PageProps<"/dashboard/services/[id]/editar">) {
  return (
    <Suspense fallback={<ListSkeleton rows={3} />}>
      <EditService params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EditService({
  params,
  searchParams,
}: {
  params: PageProps<"/dashboard/services/[id]/editar">["params"];
  searchParams: PageProps<"/dashboard/services/[id]/editar">["searchParams"];
}) {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "appointments");
  if (!can(ctx, { service: ["update"] })) notFound();
  const id = parseId((await params).id);
  const service = id ? await getService(ctx, id) : null;
  if (!service || service.archivedAt) notFound();
  const { paso } = await searchParams;
  const step = typeof paso === "string" && STEPS.includes(paso) ? paso : "nombre";
  const props = await serviceWizardProps(ctx);

  return (
    <>
      <PageHeader back={{ href: `/dashboard/services/${service.id}`, label: service.name }} title={`Cambiar ${service.name}`} />
      <ServiceWizard
        {...props}
        edit={{ id: service.id, step }}
        initial={{
          bookingType: service.bookingType,
          name: service.name,
          description: service.description ?? "",
          durationMinutes: service.durationMinutes ?? 30,
          price: service.price,
          staffIds: service.staffIds,
          stayUnit: service.stayUnit ?? "night",
          checkInTime: service.checkInTime ?? "14:00",
          checkOutTime: service.checkOutTime ?? "10:00",
          minStay: service.minStay ?? 1,
          maxStay: service.maxStay,
          weeklyPrice: service.weeklyPrice,
          monthlyPrice: service.monthlyPrice,
        }}
      />
    </>
  );
}
