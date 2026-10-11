import { ClipboardListIcon, PlusIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { requireProduct } from "@/lib/actions";
import { vocabularyFor } from "@/lib/business-types";
import { listPlans } from "@/lib/data/plans";
import { intervalLabel } from "@/lib/membership-constants";
import { formatMoney } from "@/lib/money";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Planes" };

export default function PlansPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Plans />
    </Suspense>
  );
}

async function Plans() {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "memberships");
  const words = vocabularyFor(ctx.settings.businessType).client;
  const rows = await listPlans(ctx, { includeArchived: true });
  const newButton = can(ctx, { plan: ["create"] }) && (
    <Link href="/dashboard/planes/new" className={buttonVariants()}>
      <PlusIcon aria-hidden="true" /> Nuevo plan
    </Link>
  );

  return (
    <>
      <PageHeader back={{ href: "/dashboard/negocio", label: "Mi negocio" }}
        help={{ section: "plans", settings: ctx.settings, open: rows.length === 0 }} title="Planes" description={`Lo que cobrás de forma periódica a tus ${words.many}.`} actions={rows.length > 0 && newButton} />
      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardListIcon}
          title="Todavía no creaste planes"
          description={`Por ejemplo: “Musculación · Gs. 150.000 por mes” o “Inglés intensivo · Gs. 400.000 cada 3 meses”. Cuando inscribas a un ${words.one}, Agenda genera sus cuotas.`}
          action={newButton}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((plan) => (
            <li key={plan.id}>
              <Link
                href={`/dashboard/planes/${plan.id}`}
                className={cn(
                  "flex h-full flex-col gap-3 rounded-2xl border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift",
                  plan.archivedAt && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-lg font-bold">{plan.name}</span>
                  {plan.archivedAt && <Badge variant="neutral">Archivado</Badge>}
                </div>
                <span className="text-2xl font-extrabold text-primary tabular">
                  {formatMoney(plan.price, plan.currency)}
                  <span className="ml-1.5 text-sm font-semibold text-muted-foreground">{intervalLabel(plan.intervalUnit, plan.intervalCount)}</span>
                </span>
                {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
                <Badge variant="neutral" className="mt-auto">
                  <UsersIcon aria-hidden="true" /> {plan.activeMembers} {plan.activeMembers === 1 ? words.one : words.many} activos
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
