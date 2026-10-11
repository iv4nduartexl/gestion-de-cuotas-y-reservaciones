import { CalendarClockIcon, PlusIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { EntityAvatar } from "@/components/ui-kit/entity-avatar";
import { PageHeader } from "@/components/ui-kit/page-header";
import { requireProduct } from "@/lib/actions";
import { vocabularyFor } from "@/lib/business-types";
import { listStaff } from "@/lib/data/staff";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Equipo" };

export default function StaffPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <StaffList />
    </Suspense>
  );
}

async function StaffList() {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "appointments");
  if (ctx.settings.teamMode !== "team") notFound();
  const words = vocabularyFor(ctx.settings.businessType);
  const rows = await listStaff(ctx, { includeArchived: true });
  const addButton = can(ctx, { staff: ["create"] }) && (
    <Link href="/dashboard/staff/new" className={buttonVariants()}>
      <PlusIcon aria-hidden="true" /> Agregar persona
    </Link>
  );

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/negocio", label: "Mi negocio" }}
        help={{ section: "team", settings: ctx.settings, open: rows.length <= 1 }}
        title="Equipo"
        description={`Los ${words.staff.many} que atienden turnos. Cada uno tiene su propio horario.`}
        actions={addButton}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="Todavía no hay nadie en el equipo"
          description="Agregá a cada persona que atiende turnos. Después le configurás su horario."
          action={addButton}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((person) => (
            <li
              key={person.id}
              className={cn("flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-soft", person.archivedAt && "opacity-60")}
            >
              <Link href={`/dashboard/staff/${person.id}`} className="flex items-center gap-3 hover:text-primary">
                <EntityAvatar name={person.name} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-bold">{person.name}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {person.userEmail ?? "Sin usuario del panel"}
                  </span>
                </span>
              </Link>
              <div className="mt-auto flex flex-wrap items-center gap-2">
                {person.archivedAt ? (
                  <Badge variant="neutral">Archivado</Badge>
                ) : (
                  <Link
                    href={`/dashboard/schedule?persona=${person.id}`}
                    className={buttonVariants({ variant: "soft", size: "sm" })}
                  >
                    <CalendarClockIcon aria-hidden="true" /> Ver horario
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
