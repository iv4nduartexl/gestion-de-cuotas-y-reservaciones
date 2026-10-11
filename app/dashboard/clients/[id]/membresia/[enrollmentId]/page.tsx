import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { changeBillingDayAction, changeBillingTimingAction, changeEnrollmentPriceAction } from "@/app/dashboard/cuotas/actions";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { BillingDayForm, BillingTimingForm, ChangePlanWizard, EnrollmentPriceForm } from "@/components/memberships/enrollment-edit-forms";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SummaryCard } from "@/components/wizard/summary-card";
import { parseId, requireProduct } from "@/lib/actions";
import { getClient } from "@/lib/data/clients";
import { currentPeriodEnd, getEnrollment } from "@/lib/data/enrollments";
import { listPlans } from "@/lib/data/plans";
import { formatCalendarDate, todayInZone } from "@/lib/datetime";
import { BILLING_TIMING_LABELS, ENROLLMENT_STATUS_LABELS, intervalLabel } from "@/lib/membership-constants";
import { currencyPrefix, formatMoney } from "@/lib/money";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Membresía" };

type Params = PageProps<"/dashboard/clients/[id]/membresia/[enrollmentId]">;

export default function MembershipPage({ params, searchParams }: Params) {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <Membership params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Membership({ params, searchParams }: { params: Params["params"]; searchParams: Params["searchParams"] }) {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "memberships");
  if (!can(ctx, { enrollment: ["update"] })) notFound();
  const { id: rawClientId, enrollmentId } = await params;
  const clientId = parseId(rawClientId);
  const id = parseId(enrollmentId);
  const [client, enrollment] = await Promise.all([clientId ? getClient(ctx, clientId) : null, id ? getEnrollment(ctx, id) : null]);
  if (!client || !enrollment || enrollment.clientId !== client.id) notFound();
  const plans = (await listPlans(ctx)).filter((plan) => plan.archivedAt === null);
  const plan = (await listPlans(ctx, { includeArchived: true })).find((p) => p.id === enrollment.planId);
  if (!plan) notFound();

  const today = todayInZone(ctx.settings.timezone);
  const date = (value: string) => formatCalendarDate(value, "dd/MM/yyyy");
  const prefix = currencyPrefix(enrollment.currency);
  const running = enrollment.status !== "cancelled";
  const billedUntil = currentPeriodEnd(enrollment, plan, today);
  const editing = (await searchParams).editar;
  const base = `/dashboard/clients/${client.id}/membresia/${enrollment.id}`;
  const back = { href: editing ? base : `/dashboard/clients/${client.id}`, label: editing ? "Membresía" : client.name };
  const header = (title: string) => <PageHeader back={back} title={title} description={`${client.name} · ${plan.name}`} />;

  if (running && editing === "precio") {
    return (
      <>
        {header("Cambiar precio")}
        <EnrollmentPriceForm action={changeEnrollmentPriceAction.bind(null, enrollment.id)} price={enrollment.price} currency={enrollment.currency} currencyPrefix={prefix} />
      </>
    );
  }
  if (enrollment.status === "active" && editing === "dia") {
    return (
      <>
        {header("Cambiar día de cobro")}
        <BillingDayForm action={changeBillingDayAction.bind(null, enrollment.id)} today={today} billedUntil={billedUntil} />
      </>
    );
  }
  if (running && editing === "cuando") {
    return (
      <>
        {header("Cambiar cuándo paga")}
        <BillingTimingForm action={changeBillingTimingAction.bind(null, enrollment.id)} timing={enrollment.billingTiming} />
      </>
    );
  }
  const otherPlans = plans.filter((p) => p.id !== enrollment.planId);
  if (running && editing === "plan" && otherPlans.length > 0) {
    return (
      <>
        {header("Cambiar de plan")}
        <ChangePlanWizard
          enrollmentId={enrollment.id}
          clientId={client.id}
          clientName={client.name}
          plans={otherPlans}
          today={today}
          suggestedStart={enrollment.status === "active" ? billedUntil : today}
          currencyPrefix={prefix}
        />
      </>
    );
  }

  const href = (what: string, allowed = running) => (allowed ? `${base}?editar=${what}` : undefined);
  return (
    <>
      <PageHeader
        back={back}
        title={`Membresía de ${client.name}`}
        meta={<Badge variant={enrollment.status === "active" ? "success" : enrollment.status === "paused" ? "warning" : "neutral"}>{ENROLLMENT_STATUS_LABELS[enrollment.status]}</Badge>}
        description="Tocá “Cambiar” en lo que quieras modificar. Lo ya cobrado no cambia."
      />
      <SummaryCard
        rows={[
          { label: "Plan", value: plan.name, href: href("plan", running && otherPlans.length > 0) },
          { label: "Precio", value: `${formatMoney(enrollment.price, enrollment.currency)} ${intervalLabel(plan.intervalUnit, plan.intervalCount)}`, href: href("precio") },
          {
            label: "Día de cobro",
            value: enrollment.status === "active" ? `Período actual hasta el ${date(billedUntil)}` : `Desde el ${date(enrollment.startDate)}`,
            href: href("dia", enrollment.status === "active"),
          },
          { label: "Cuándo paga", value: BILLING_TIMING_LABELS[enrollment.billingTiming], href: href("cuando") },
          { label: "Socio desde", value: date(enrollment.memberSince ?? enrollment.startDate) },
        ]}
      />
    </>
  );
}
