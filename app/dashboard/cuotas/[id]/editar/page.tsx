import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { changeChargeAmountAction, moveDueDateAction, updatePaymentAction } from "@/app/dashboard/cuotas/actions";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { ChangeAmountForm, EditPaymentForm, MoveDueForm, SplitForm } from "@/components/memberships/charge-edit-forms";
import { PageHeader } from "@/components/ui-kit/page-header";
import { parseId, requireProduct } from "@/lib/actions";
import { getCharge } from "@/lib/data/charges";
import { formatInZone, todayInZone } from "@/lib/datetime";
import { currencyPrefix } from "@/lib/money";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Cambiar cuota" };

export default function EditChargePage({ params, searchParams }: PageProps<"/dashboard/cuotas/[id]/editar">) {
  return (
    <Suspense fallback={<ListSkeleton rows={3} />}>
      <EditCharge params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EditCharge({
  params,
  searchParams,
}: {
  params: PageProps<"/dashboard/cuotas/[id]/editar">["params"];
  searchParams: PageProps<"/dashboard/cuotas/[id]/editar">["searchParams"];
}) {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "memberships");
  const today = todayInZone(ctx.settings.timezone);
  const id = parseId((await params).id);
  const charge = id ? await getCharge(ctx, id, today) : null;
  if (!charge) notFound();
  const query = await searchParams;
  const prefix = currencyPrefix(charge.currency);
  const header = (title: string) => (
    <PageHeader back={{ href: `/dashboard/cuotas/${charge.id}`, label: "Cuota" }} title={title} description={`${charge.planName} · ${charge.clientName}`} />
  );

  if (query.que === "pago") {
    const payment = charge.payments.find((p) => p.id === query.pago);
    if (!payment || payment.provider || !can(ctx, { payment: ["delete"] }) || charge.status === "void") notFound();
    return (
      <>
        {header("Corregir pago")}
        <EditPaymentForm
          action={updatePaymentAction.bind(null, payment.id)}
          payment={{
            amount: payment.amount,
            method: payment.method,
            paidOn: formatInZone(payment.paidAt, ctx.settings.timezone, "yyyy-MM-dd"),
            reference: payment.reference,
          }}
          currency={charge.currency}
          currencyPrefix={prefix}
        />
      </>
    );
  }

  // Due date, amount and parts: only while something is still owed.
  if (charge.status !== "pending" || !can(ctx, { enrollment: ["update"] })) notFound();

  if (query.que === "monto") {
    return (
      <>
        {header("Cambiar monto")}
        <ChangeAmountForm
          action={changeChargeAmountAction.bind(null, charge.id)}
          amount={charge.amount}
          paid={charge.amountPaid}
          currency={charge.currency}
          currencyPrefix={prefix}
        />
      </>
    );
  }

  if (query.que === "dividir") {
    return (
      <>
        {header("Dividir en partes")}
        <SplitForm chargeId={charge.id} remaining={charge.remaining} dueDate={charge.dueDate} today={today} currency={charge.currency} currencyPrefix={prefix} />
      </>
    );
  }

  return (
    <>
      {header("Darle más tiempo")}
      <MoveDueForm action={moveDueDateAction.bind(null, charge.id)} dueDate={charge.dueDate} today={today} />
    </>
  );
}
