import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { EnrollWizard } from "@/components/memberships/enroll-wizard";
import { PageHeader } from "@/components/ui-kit/page-header";
import { parseId, requireProduct } from "@/lib/actions";
import { getClient } from "@/lib/data/clients";
import { listPlans } from "@/lib/data/plans";
import { todayInZone } from "@/lib/datetime";
import { currencyPrefix } from "@/lib/money";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Inscribir en un plan" };

export default function EnrollPage({ params }: PageProps<"/dashboard/clients/[id]/inscribir">) {
  return (
    <Suspense fallback={<ListSkeleton rows={3} />}>
      <Enroll params={params} />
    </Suspense>
  );
}

async function Enroll({ params }: { params: PageProps<"/dashboard/clients/[id]/inscribir">["params"] }) {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "memberships");
  if (!can(ctx, { enrollment: ["create"] })) notFound();
  const id = parseId((await params).id);
  const client = id ? await getClient(ctx, id) : null;
  if (!client || client.archivedAt) notFound();
  const plans = (await listPlans(ctx)).filter((plan) => plan.archivedAt === null);
  if (plans.length === 0) redirect("/dashboard/planes/new");

  return (
    <>
      <PageHeader back={{ href: `/dashboard/clients/${client.id}`, label: client.name }} title="Inscribir en un plan" />
      <EnrollWizard
        clientId={client.id}
        clientName={client.name}
        plans={plans}
        today={todayInZone(ctx.settings.timezone)}
        currencyPrefix={currencyPrefix(ctx.settings.currency)}
      />
    </>
  );
}
