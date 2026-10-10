import { ClockIcon, PlusIcon, ScissorsIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { sectionHelp } from "@/lib/help-content";
import { PageHeader } from "@/components/ui-kit/page-header";
import { requireProduct } from "@/lib/actions";
import { capitalize, vocabularyFor } from "@/lib/business-types";
import { listServices } from "@/lib/data/services";
import { formatDuration } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Servicios" };

export default function ServicesPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <ServiceList />
    </Suspense>
  );
}

async function ServiceList() {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "appointments");
  const words = vocabularyFor(ctx.settings.businessType);
  const rows = await listServices(ctx, { includeArchived: true });
  const canCreate = can(ctx, { service: ["create"] });
  const isTeam = ctx.settings.teamMode === "team";
  const newButton = canCreate && (
    <Link href="/dashboard/services/new" className={buttonVariants()}>
      <PlusIcon aria-hidden="true" /> Agregar {words.service.one}
    </Link>
  );

  return (
    <>
      <PageHeader
        help={{ section: "services", settings: ctx.settings, open: rows.length === 0 }}
        title={capitalize(words.service.many)}
        description={`Lo que tus ${words.client.many} pueden reservar, con su duración y su precio.`}
        actions={rows.length > 0 && newButton}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={ScissorsIcon}
          title={`Todavía no cargaste ${words.service.many}`}
          description={`Cada ${words.service.one} tiene una duración (cuánto tiempo se reserva en tu agenda) y un precio. Por ejemplo: “${sectionHelp("services", ctx.settings).example}”.`}
          action={newButton}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((service) => (
            <li key={service.id}>
              <Link
                href={`/dashboard/services/${service.id}`}
                className={cn(
                  "flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift",
                  service.archivedAt && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-lg font-bold leading-snug">{service.name}</span>
                  {service.archivedAt && <Badge variant="neutral">Archivado</Badge>}
                </div>
                <span className="text-2xl font-extrabold text-primary tabular">
                  {formatMoney(service.price, service.currency)}
                </span>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Badge variant="info">
                    <ClockIcon aria-hidden="true" /> {formatDuration(service.durationMinutes)}
                  </Badge>
                  {isTeam && (
                    <Badge variant={service.staffCount === 0 ? "warning" : "neutral"}>
                      <UsersIcon aria-hidden="true" />
                      {service.staffCount === 0
                        ? "Sin personas asignadas"
                        : `${service.staffCount} ${service.staffCount === 1 ? words.staff.one : words.staff.many}`}
                    </Badge>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
