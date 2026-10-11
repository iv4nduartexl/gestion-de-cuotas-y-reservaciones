import type { Metadata } from "next";
import { Suspense } from "react";

import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { PlanWizard } from "@/components/memberships/plan-wizard";
import { PageHeader } from "@/components/ui-kit/page-header";
import { requireProduct } from "@/lib/actions";
import { vocabularyFor } from "@/lib/business-types";
import { todayInZone } from "@/lib/datetime";
import { planExample } from "@/lib/help-content";
import { currencyPrefix } from "@/lib/money";
import { getTenantContextOrRedirect } from "@/lib/tenant";
import { NEW_PLAN_VALUES } from "@/lib/wizard-values";

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
      <PageHeader back={{ href: "/dashboard/planes", label: "Planes" }} title="Nuevo plan" />
      <PlanWizard
        initial={NEW_PLAN_VALUES}
        currency={ctx.settings.currency}
        currencyPrefix={currencyPrefix(ctx.settings.currency)}
        today={todayInZone(ctx.settings.timezone)}
        example={planExample(ctx.settings.businessType)}
        clientWord={vocabularyFor(ctx.settings.businessType).client.one}
      />
    </>
  );
}
