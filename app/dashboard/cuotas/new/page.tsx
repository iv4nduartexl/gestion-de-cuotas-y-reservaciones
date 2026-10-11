import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { ChargeWizard } from "@/components/memberships/charge-wizard";
import { PageHeader } from "@/components/ui-kit/page-header";
import { parseId, requireProduct } from "@/lib/actions";
import { vocabularyFor } from "@/lib/business-types";
import { getClient } from "@/lib/data/clients";
import { listPlans } from "@/lib/data/plans";
import { todayInZone } from "@/lib/datetime";
import { currencyPrefix } from "@/lib/money";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Nuevo cobro" };

export default function NewChargePage({ searchParams }: PageProps<"/dashboard/cuotas/new">) {
  return (
    <Suspense fallback={<ListSkeleton rows={3} />}>
      <NewCharge searchParams={searchParams} />
    </Suspense>
  );
}

async function NewCharge({ searchParams }: { searchParams: PageProps<"/dashboard/cuotas/new">["searchParams"] }) {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "memberships");
  if (!can(ctx, { enrollment: ["create"], client: ["create"] })) notFound();
  const params = await searchParams;
  const clientId = typeof params.cliente === "string" ? parseId(params.cliente) : null;
  const [plans, client] = await Promise.all([listPlans(ctx), clientId ? getClient(ctx, clientId) : Promise.resolve(null)]);
  const words = vocabularyFor(ctx.settings.businessType).client;
  const known = client && !client.archivedAt ? { id: client.id, name: client.name, phone: client.phone } : null;

  return (
    <>
      <PageHeader
        back={known ? { href: `/dashboard/clients/${known.id}`, label: known.name } : { href: "/dashboard/cuotas", label: "Cuotas" }}
        title="Nuevo cobro"
        description="Una cuota de un plan o un cobro único. Te guiamos paso a paso."
      />
      <ChargeWizard
        plans={plans.filter((plan) => plan.archivedAt === null)}
        today={todayInZone(ctx.settings.timezone)}
        currency={ctx.settings.currency}
        currencyPrefix={currencyPrefix(ctx.settings.currency)}
        clientNoun={words.one}
        initialClient={known}
      />
    </>
  );
}
