import Link from "next/link";

import { changeEnrollmentAction } from "@/app/dashboard/cuotas/actions";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SectionCard } from "@/components/ui-kit/section-card";
import { memberStatus } from "@/lib/billing";
import type { ChargeWithStatus } from "@/lib/data/charges";
import { formatCalendarDate } from "@/lib/datetime";
import { ENROLLMENT_STATUS_LABELS, intervalLabel, type EnrollmentStatus, type IntervalUnit } from "@/lib/membership-constants";
import { currencyPrefix, formatAmountInput, formatMoney } from "@/lib/money";
import { ChargeBadge } from "./charge-badge";
import { EnrollForm } from "./enroll-form";
import { PaymentDialog } from "./payment-dialog";

type Enrollment = {
  id: string;
  status: EnrollmentStatus;
  startDate: string;
  price: number;
  currency: string;
  planName: string;
  intervalUnit: IntervalUnit;
  intervalCount: number;
};

export function MembershipSection({
  clientId,
  clientName,
  enrollments,
  charges,
  plans,
  today,
  currency,
  canEnroll,
  canManage,
  canPay,
}: {
  clientId: string;
  clientName: string;
  enrollments: Enrollment[];
  charges: ChargeWithStatus[];
  plans: { id: string; name: string; price: number; currency: string; intervalUnit: IntervalUnit; intervalCount: number }[];
  today: string;
  currency: string;
  canEnroll: boolean;
  canManage: boolean;
  canPay: boolean;
}) {
  const status = memberStatus(
    charges.map((c) => ({ status: c.derived, amount: c.amount, amountPaid: c.amountPaid, dueDate: c.dueDate })),
    today,
  );
  const badge =
    status.kind === "al_dia" ? (
      <Badge variant="success">Al día</Badge>
    ) : status.kind === "vencido" ? (
      <Badge variant="coral">Vencido · debe {formatMoney(status.owed, currency)}</Badge>
    ) : (
      <Badge variant="warning">Debe {formatMoney(status.owed, currency)}</Badge>
    );

  return (
    <SectionCard
      title="Membresía"
      description={enrollments.length === 0 ? "Inscribilo en un plan y sus cuotas se generan solas." : undefined}
      actions={enrollments.length > 0 && badge}
    >
      {enrollments.length > 0 && (
        <ul className="flex flex-col gap-2">
          {enrollments.map((enrollment) => (
            <li key={enrollment.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-bold">{enrollment.planName}</span>
                <span className="text-sm text-muted-foreground tabular">
                  {formatMoney(enrollment.price, enrollment.currency)} {intervalLabel(enrollment.intervalUnit, enrollment.intervalCount)} · desde{" "}
                  {formatCalendarDate(enrollment.startDate, "dd/MM/yyyy")}
                </span>
              </span>
              <Badge variant={enrollment.status === "active" ? "success" : enrollment.status === "paused" ? "warning" : "neutral"}>
                {ENROLLMENT_STATUS_LABELS[enrollment.status]}
              </Badge>
              {canManage && enrollment.status !== "cancelled" && (
                <div className="flex gap-1">
                  {enrollment.status === "active" ? (
                    <ConfirmActionButton
                      action={changeEnrollmentAction.bind(null, enrollment.id, "pause")}
                      label="Pausar"
                      size="sm"
                      variant="ghost"
                      title="¿Pausar la membresía?"
                      description="No se generan cuotas mientras esté pausada (por ejemplo, vacaciones o lesión). Lo que ya debe se mantiene."
                      successMessage="Membresía pausada"
                    />
                  ) : (
                    <ConfirmActionButton
                      action={changeEnrollmentAction.bind(null, enrollment.id, "resume")}
                      label="Reactivar"
                      size="sm"
                      variant="ghost"
                      title="¿Reactivar la membresía?"
                      description="Las cuotas vuelven a generarse desde el período actual. Los meses en pausa no se cobran."
                      successMessage="Membresía reactivada"
                    />
                  )}
                  <ConfirmActionButton
                    action={changeEnrollmentAction.bind(null, enrollment.id, "cancel")}
                    label="Dar de baja"
                    size="sm"
                    variant="ghost"
                    title="¿Dar de baja?"
                    description="No se generan más cuotas y se anulan las futuras sin pagos. Lo que ya debe se mantiene."
                    confirmLabel="Dar de baja"
                    successMessage="Membresía cancelada"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEnroll &&
        (plans.length > 0 ? (
          <EnrollForm clientId={clientId} plans={plans} today={today} currencyPrefix={currencyPrefix(currency)} />
        ) : (
          <Link href="/dashboard/planes/new" className={buttonVariants({ variant: "soft" })}>
            Crear un plan primero
          </Link>
        ))}

      {charges.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-muted-foreground">Cuotas</h3>
          <ul className="flex flex-col divide-y">
            {charges.map((charge) => {
              const open = charge.derived === "pendiente" || charge.derived === "parcial" || charge.derived === "vencida";
              return (
                <li key={charge.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <Link href={`/dashboard/cuotas/${charge.id}`} className="flex min-w-0 flex-1 flex-col hover:text-primary">
                    <span className="font-semibold tabular">vence {formatCalendarDate(charge.dueDate, "dd/MM/yyyy")}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {charge.planName} · {formatMoney(charge.amount, charge.currency)}
                      {charge.amountPaid > 0 && charge.derived !== "pagada" && ` · pagó ${formatMoney(charge.amountPaid, charge.currency)}`}
                    </span>
                  </Link>
                  <ChargeBadge status={charge.derived} />
                  {open && canPay && (
                    <PaymentDialog
                      chargeId={charge.id}
                      clientName={clientName}
                      description={`${charge.planName} · vence ${formatCalendarDate(charge.dueDate, "dd/MM/yyyy")}`}
                      remainingInput={formatAmountInput(charge.remaining, charge.currency)}
                      remainingLabel={formatMoney(charge.remaining, charge.currency)}
                      currencyPrefix={currencyPrefix(charge.currency)}
                      today={today}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
