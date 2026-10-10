import { ScissorsIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { NewAppointmentForm } from "@/components/agenda/new-appointment-form";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { requireProduct } from "@/lib/actions";
import { getAvailability, listActiveStaffNames, listBookableServices } from "@/lib/booking";
import { vocabularyFor } from "@/lib/business-types";
import { getStaffForMember } from "@/lib/data/staff";
import { DATE_PATTERN, todayInZone } from "@/lib/datetime";
import { getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Nuevo turno" };

export default function NewAppointmentPage({ searchParams }: PageProps<"/dashboard/agenda/new">) {
  return (
    <Suspense fallback={<ListSkeleton rows={5} />}>
      <NewAppointment searchParams={searchParams} />
    </Suspense>
  );
}

async function NewAppointment({ searchParams }: { searchParams: PageProps<"/dashboard/agenda/new">["searchParams"] }) {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "appointments");
  const params = await searchParams;
  const words = vocabularyFor(ctx.settings.businessType);
  const today = todayInZone(ctx.settings.timezone);
  const date = typeof params.fecha === "string" && DATE_PATTERN.test(params.fecha) && params.fecha >= today ? params.fecha : today;

  const [services, staff, own] = await Promise.all([
    listBookableServices(ctx),
    listActiveStaffNames(ctx),
    ctx.role === "member" ? getStaffForMember(ctx, ctx.memberId) : Promise.resolve(null),
  ]);
  const bookable = services.filter((s) => s.staffIds.length > 0);
  const lockedStaffId = ctx.role === "member" ? (own?.id ?? "none") : null;
  const initialStaffId = lockedStaffId ?? (typeof params.persona === "string" ? params.persona : null);
  // Preload free times for the default service and day.
  const initialSlots = bookable[0]
    ? (await getAvailability(ctx, bookable[0], initialStaffId ?? "any", date, 1, { online: false }))[0].slots.map(
        ({ start, time }) => ({ start, time }),
      )
    : [];

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/agenda", label: "Agenda" }}
        title="Nuevo turno"
        description="Para quien te llama o llega sin reserva. Queda confirmado."
      />
      {bookable.length === 0 ? (
        <EmptyState
          icon={ScissorsIcon}
          title={`Primero cargá tus ${words.service.many}`}
          description="Cada turno es de un servicio, con su duración y precio."
          action={
            <Link href="/dashboard/services/new" className={buttonVariants()}>
              Agregar {words.service.one}
            </Link>
          }
        />
      ) : (
        <NewAppointmentForm
          services={bookable}
          staff={staff}
          showStaff={ctx.settings.teamMode === "team"}
          lockedStaffId={lockedStaffId}
          initialDate={date}
          initialStaffId={initialStaffId}
          initialSlots={initialSlots}
          clientNoun={words.client.one}
        />
      )}
    </>
  );
}
