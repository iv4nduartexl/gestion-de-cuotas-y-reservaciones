import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { deletePaymentAction, voidChargeAction } from "@/app/dashboard/cuotas/actions";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { ChargeBadge } from "@/components/memberships/charge-badge";
import { PaymentDialog } from "@/components/memberships/payment-dialog";
import { ReminderLink } from "@/components/memberships/reminder-link";
import { EntityAvatar } from "@/components/ui-kit/entity-avatar";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SectionCard } from "@/components/ui-kit/section-card";
import { parseId, requireProduct } from "@/lib/actions";
import { addDays } from "@/lib/billing";
import { getCharge } from "@/lib/data/charges";
import { formatCalendarDate, formatInZone, todayInZone } from "@/lib/datetime";
import { PAYMENT_METHOD_LABELS } from "@/lib/membership-constants";
import { currencyPrefix, formatAmountInput, formatMoney } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Cuota" };

export default function ChargePage({ params }: PageProps<"/dashboard/cuotas/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <ChargeDetail params={params} />
    </Suspense>
  );
}

async function ChargeDetail({ params }: { params: PageProps<"/dashboard/cuotas/[id]">["params"] }) {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "memberships");
  const today = todayInZone(ctx.settings.timezone);
  const id = parseId((await params).id);
  const charge = id ? await getCharge(ctx, id, today) : null;
  if (!charge) notFound();

  const money = (amount: number) => formatMoney(amount, charge.currency);
  const date = (value: string) => formatCalendarDate(value, "dd/MM/yyyy");
  const open = charge.derived === "pendiente" || charge.derived === "parcial" || charge.derived === "vencida";
  const canUndo = can(ctx, { payment: ["delete"] });
  const canVoid = can(ctx, { payment: ["void"] }) && open && charge.amountPaid === 0;
  const canChange = can(ctx, { enrollment: ["update"] }) && charge.status === "pending";
  const canFixPayments = can(ctx, { payment: ["delete"] }) && charge.status !== "void";
  const editHref = (que: string) => `/dashboard/cuotas/${charge.id}/editar?que=${que}`;

  const rows: [string, React.ReactNode, string?][] = [
    [charge.kind === "cuota" ? "Plan" : "Concepto", charge.planName],
    ...(charge.parentChargeId
      ? ([["Viene de", <Link key="p" href={`/dashboard/cuotas/${charge.parentChargeId}`} className="text-primary hover:underline">la cuota original</Link>]] as [string, React.ReactNode][])
      : []),
    ...(charge.periodStart && charge.periodEnd
      ? ([["Período", `${date(charge.periodStart)} al ${date(addDays(charge.periodEnd, -1))}`]] as [string, React.ReactNode][])
      : []),
    ["Vence", date(charge.dueDate), canChange ? editHref("vence") : undefined],
    ["Monto", money(charge.amount), canChange ? editHref("monto") : undefined],
    ["Pagado", money(charge.amountPaid)],
    ...(open ? ([["Falta", <strong key="r" className="text-coral-foreground">{money(charge.remaining)}</strong>]] as [string, React.ReactNode][]) : []),
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/cuotas", label: "Cuotas" }}
        title={`Cuota de ${charge.clientName}`}
        meta={<ChargeBadge status={charge.derived} />}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          <SectionCard title="Detalle">
            <dl className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              {rows.map(([label, value, edit]) => (
                <div key={label} className="contents">
                  <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
                  <dd className="flex items-center justify-between gap-3 font-semibold tabular">
                    {value}
                    {edit && (
                      <Link href={edit} className="text-sm font-semibold text-primary hover:underline" aria-label={`Cambiar ${label.toLowerCase()}`}>
                        Cambiar
                      </Link>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            {open && (
              <div className="flex flex-wrap gap-2">
                {can(ctx, { payment: ["create"] }) && (
                  <PaymentDialog
                    chargeId={charge.id}
                    clientName={charge.clientName}
                    description={`${charge.planName} · vence ${date(charge.dueDate)}`}
                    remainingInput={formatAmountInput(charge.remaining, charge.currency)}
                    remainingLabel={money(charge.remaining)}
                    currencyPrefix={currencyPrefix(charge.currency)}
                    today={today}
                    size="default"
                  />
                )}
                <ReminderLink charge={charge} template={ctx.settings.paymentReminderTemplate} withLabel />
                {canChange && (
                  <Link href={editHref("vence")} className={buttonVariants({ variant: "outline" })}>
                    Darle más tiempo
                  </Link>
                )}
                {canChange && charge.remaining >= 2 && (
                  <Link href={editHref("dividir")} className={buttonVariants({ variant: "ghost" })}>
                    Dividir en partes
                  </Link>
                )}
                {canVoid && (
                  <ConfirmActionButton
                    action={voidChargeAction.bind(null, charge.id)}
                    label="Anular cuota"
                    variant="ghost"
                    title="¿Anular esta cuota?"
                    description="Deja de figurar como deuda (por ejemplo, si le perdonaste el mes). No se puede deshacer."
                    confirmLabel="Anular"
                    successMessage="Cuota anulada"
                  />
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Pagos" description={charge.payments.length === 0 ? "Todavía no se registró ningún pago." : undefined}>
            {charge.payments.length > 0 && (
              <ul className="flex flex-col divide-y">
                {charge.payments.map((payment) => (
                  <li key={payment.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="flex flex-1 flex-col">
                      <span className="font-bold tabular">{money(payment.amount)}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatInZone(payment.paidAt, ctx.settings.timezone, "dd/MM/yyyy")} · {PAYMENT_METHOD_LABELS[payment.method].split(" (")[0]}
                        {payment.reference && ` · ${payment.reference}`}
                      </span>
                    </span>
                    {canFixPayments && !payment.provider && (
                      <Link
                        href={`/dashboard/cuotas/${charge.id}/editar?que=pago&pago=${payment.id}`}
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
                        aria-label={`Corregir pago de ${money(payment.amount)}`}
                      >
                        Corregir
                      </Link>
                    )}
                    {canUndo && (
                      <ConfirmActionButton
                        action={deletePaymentAction.bind(null, payment.id)}
                        label="Deshacer"
                        size="sm"
                        variant="ghost"
                        title="¿Deshacer este pago?"
                        description="Se borra el pago y la cuota vuelve a figurar como pendiente por ese monto."
                        confirmLabel="Deshacer"
                        successMessage="Pago deshecho"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Socio">
          <Link href={`/dashboard/clients/${charge.clientId}`} className="flex items-center gap-3 hover:text-primary">
            <EntityAvatar name={charge.clientName} />
            <span className="flex flex-col">
              <span className="font-bold">{charge.clientName}</span>
              <span className="text-sm text-muted-foreground tabular">{formatPhone(charge.clientPhone)}</span>
            </span>
          </Link>
        </SectionCard>
      </div>
    </>
  );
}
