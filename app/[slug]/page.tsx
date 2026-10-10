import { CalendarClockIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";

import { BookingFlow } from "@/components/booking/booking-flow";
import { BusinessHeader } from "@/components/booking/business-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { getPublicBusiness, getPublicCatalog } from "@/lib/data/public";
import { redirectedSlug } from "@/lib/data/slugs";
import { todayInZone } from "@/lib/datetime";

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const business = await getPublicBusiness((await params).slug);
  return business
    ? { title: `Reservá en ${business.organization.name}`, description: business.settings.description ?? undefined }
    : { title: "Página no encontrada" };
}

export default function BookingPage({ params }: PageProps<"/[slug]">) {
  return (
    <Suspense fallback={<BookingSkeleton />}>
      <Booking params={params} />
    </Suspense>
  );
}

async function Booking({ params }: { params: PageProps<"/[slug]">["params"] }) {
  const { slug } = await params;
  const business = await getPublicBusiness(slug);
  if (!business) {
    // An old link of a business that changed its address.
    const current = await redirectedSlug(slug);
    if (current) permanentRedirect(`/${current}`);
    notFound();
  }

  const { settings, organization } = business;
  const catalog = await getPublicCatalog(business);

  return (
    <>
      <BusinessHeader
        name={organization.name}
        description={settings.description}
        address={settings.address}
        publicPhone={settings.publicPhone}
      />
      {catalog.services.length === 0 ? (
        <EmptyState
          icon={CalendarClockIcon}
          title="Todavía no hay turnos disponibles"
          description={`${organization.name} está configurando sus horarios y servicios. Volvé a intentar en unos días${settings.publicPhone ? " o escribile por WhatsApp" : ""}.`}
        />
      ) : (
        <BookingFlow
          slug={slug}
          services={catalog.services}
          staff={catalog.staff}
          showStaffStep={settings.teamMode === "team"}
          today={todayInZone(settings.timezone)}
          autoConfirm={settings.autoConfirmBookings}
        />
      )}
    </>
  );
}

function BookingSkeleton() {
  return (
    <>
      <Skeleton className="h-32 rounded-3xl" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
    </>
  );
}
