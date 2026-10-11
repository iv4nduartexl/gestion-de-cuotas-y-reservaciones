import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { PlanWizard } from "@/components/memberships/plan-wizard";
import { PageHeader } from "@/components/ui-kit/page-header";
import { parseId, requireProduct } from "@/lib/actions";
import { vocabularyFor } from "@/lib/business-types";
import { getPlan } from "@/lib/data/plans";
import { todayInZone } from "@/lib/datetime";
import { planExample } from "@/lib/help-content";
import { currencyPrefix } from "@/lib/money";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Cambiar plan" };

const STEPS = ["nombre", "precio", "frecuencia", "cobro"];

export default function EditPlanPage({ params, searchParams }: PageProps<"/dashboard/planes/[id]/editar">) {
  return (
    <Suspense fallback={<ListSkeleton rows={3} />}>
      <EditPlan params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EditPlan({
  params,
  searchParams,
}: {
  params: PageProps<"/dashboard/planes/[id]/editar">["params"];
  searchParams: PageProps<"/dashboard/planes/[id]/editar">["searchParams"];
}) {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "memberships");
  if (!can(ctx, { plan: ["update"] })) notFound();
  const id = parseId((await params).id);
  const plan = id ? await getPlan(ctx, id) : null;
  if (!plan || plan.archivedAt) notFound();
  const { paso } = await searchParams;
  const step = typeof paso === "string" && STEPS.includes(paso) ? paso : "nombre";

  return (
    <>
      <PageHeader back={{ href: `/dashboard/planes/${plan.id}`, label: plan.name }} title={`Cambiar ${plan.name}`} />
      <PlanWizard
        edit={{ id: plan.id, step }}
        initial={{
          name: plan.name,
          description: plan.description ?? "",
          price: plan.price,
          intervalUnit: plan.intervalUnit,
          intervalCount: plan.intervalCount,
          billingTiming: plan.billingTiming,
        }}
        currency={plan.currency}
        currencyPrefix={currencyPrefix(plan.currency)}
        today={todayInZone(ctx.settings.timezone)}
        example={planExample(ctx.settings.businessType)}
        clientWord={vocabularyFor(ctx.settings.businessType).client.one}
      />
    </>
  );
}
