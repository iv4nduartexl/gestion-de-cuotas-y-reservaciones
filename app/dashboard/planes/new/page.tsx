import type { Metadata } from "next";
import { Suspense } from "react";

import { createPlanAction } from "@/app/dashboard/planes/actions";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { PlanForm } from "@/components/memberships/plan-form";
import { PageHeader } from "@/components/ui-kit/page-header";
import { requireProduct } from "@/lib/actions";
import { currencyPrefix } from "@/lib/money";
import { getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Nuevo plan" };

export default function NewPlanPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={3} />}>
      <NewPlan />
    </Suspense>
  );
}

async function NewPlan() {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "memberships");
  return (
    <>
      <PageHeader back={{ href: "/dashboard/planes", label: "Planes" }} title="Nuevo plan" description="Podés cambiarlo cuando quieras." />
      <PlanForm action={createPlanAction} currencyPrefix={currencyPrefix(ctx.settings.currency)} submitLabel="Crear plan" />
    </>
  );
}
