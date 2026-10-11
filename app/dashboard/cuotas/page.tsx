import { AlertTriangleIcon, ChevronRightIcon, ClipboardListIcon, PlusIcon, SearchIcon, TrendingUpIcon, UsersIcon, WalletIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { Pagination } from "@/components/dashboard/pagination";
import { ChargeBadge } from "@/components/memberships/charge-badge";
import { PaymentDialog } from "@/components/memberships/payment-dialog";
import { ReminderLink } from "@/components/memberships/reminder-link";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { EntityAvatar } from "@/components/ui-kit/entity-avatar";
import { PageHeader } from "@/components/ui-kit/page-header";
import { requireProduct } from "@/lib/actions";
import { vocabularyFor } from "@/lib/business-types";
import { listCharges, monthSummary, syncCharges, type ChargeFilter } from "@/lib/data/charges";
import { listPlans } from "@/lib/data/plans";
import { formatCalendarDate, todayInZone } from "@/lib/datetime";
import { currencyPrefix, formatAmountInput, formatMoney } from "@/lib/money";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cuotas" };

const FILTERS: { value: ChargeFilter; label: string }[] = [
  { value: "vencidas", label: "Vencidas" },
  { value: "por-cobrar", label: "Por cobrar" },
  { value: "pagadas", label: "Pagadas" },
  { value: "todas", label: "Todas" },
];

export default function CuotasPage({ searchParams }: PageProps<"/dashboard/cuotas">) {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <Cuotas searchParams={searchParams} />
    </Suspense>
  );
}

async function Cuotas({ searchParams }: { searchParams: PageProps<"/dashboard/cuotas">["searchParams"] }) {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "memberships");
  const words = vocabularyFor(ctx.settings.businessType).client;
  const today = todayInZone(ctx.settings.timezone);
  const params = await searchParams;

  // Generate any cuotas that became due (idempotent).
  await syncCharges(ctx, { today });
  const [summary, plans] = await Promise.all([monthSummary(ctx, today), listPlans(ctx)]);

  const requested = FILTERS.find((f) => f.value === params.filtro)?.value;
  const filter: ChargeFilter = requested ?? (summary.overdueCount > 0 ? "vencidas" : "por-cobrar");
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const page = Math.max(1, Number(params.page) || 1);
  const result = await listCharges(ctx, { filter, q, page, today });

  const hrefFor = (next: { filtro?: ChargeFilter; page?: number }) => {
    const search = new URLSearchParams();
    search.set("filtro", next.filtro ?? filter);
    if (q) search.set("q", q);
    if (next.page && next.page > 1) search.set("page", String(next.page));
    return `/dashboard/cuotas?${search.toString()}`;
  };

  const canCreate = can(ctx, { enrollment: ["create"], client: ["create"] });
  const newChargeButton = canCreate && (
    <Link href="/dashboard/cuotas/new" className={buttonVariants()}>
      <PlusIcon aria-hidden="true" /> Nuevo cobro
    </Link>
  );

  // Without plans and without one-off charges there's nothing to list yet.
  if (plans.length === 0 && result.total === 0 && !q && filter !== "todas" && summary.collected === 0) {
    return (
      <>
        <PageHeader help={{ section: "cuotas", settings: ctx.settings, open: true }} title="Cuotas" description={`Quién pagó, quién debe y quién está vencido, mes a mes.`} />
        <EmptyState
          icon={ClipboardListIcon}
          title="Primero creá un plan"
          description={`Un plan es lo que cobrás de forma periódica, por ejemplo “Musculación · Gs. 150.000 por mes”. Después inscribís a tus ${words.many} y Agenda arma sus cuotas solo.`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/dashboard/planes/new" className={buttonVariants({ size: "lg" })}>
                Crear mi primer plan
              </Link>
              {canCreate && (
                <Link href="/dashboard/cuotas/new" className={buttonVariants({ size: "lg", variant: "outline" })}>
                  Cobrar algo una sola vez
                </Link>
              )}
            </div>
          }
        />
      </>
    );
  }

  const canPay = can(ctx, { payment: ["create"] });
  const prefix = currencyPrefix(ctx.settings.currency);
  const money = (amount: number) => formatMoney(amount, ctx.settings.currency);

  return (
    <>
      <PageHeader
        help={{ section: "cuotas", settings: ctx.settings, open: summary.activeMembers === 0 }}
        title="Cuotas"
        description={`Quién pagó, quién debe y quién está vencido. Las cuotas se generan solas según el plan de cada ${words.one}.`}
        actions={newChargeButton}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard icon={TrendingUpIcon} label="Cobrado este mes" value={money(summary.collected)} tone="success" />
        <SummaryCard icon={WalletIcon} label="Por cobrar este mes" value={money(summary.toCollect)} tone="info" />
        <SummaryCard
          icon={AlertTriangleIcon}
          label={`${summary.overdueCount} cuota${summary.overdueCount === 1 ? "" : "s"} vencida${summary.overdueCount === 1 ? "" : "s"}`}
          value={money(summary.overdueAmount)}
          tone={summary.overdueCount > 0 ? "coral" : "neutral"}
        />
        <SummaryCard icon={UsersIcon} label={`${words.many} activos`} value={String(summary.activeMembers)} tone="neutral" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1" role="group" aria-label="Filtrar cuotas">
          {FILTERS.map((option) => (
            <Link
              key={option.value}
              href={hrefFor({ filtro: option.value, page: 1 })}
              aria-current={option.value === filter ? "true" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors",
                option.value === filter ? "bg-primary text-primary-foreground" : "border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </Link>
          ))}
        </div>
        <form className="flex w-full gap-2 sm:max-w-xs" role="search">
          <input type="hidden" name="filtro" value={filter} />
          <label className="relative flex-1">
            <span className="sr-only">Buscar</span>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input name="q" type="search" defaultValue={q} placeholder="Nombre, teléfono o plan" aria-label="Buscar cuotas" className="pl-9" />
          </label>
        </form>
      </div>

      {result.rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          {q
            ? `No hay cuotas que coincidan con “${q}”.`
            : filter === "vencidas"
              ? "¡No hay cuotas vencidas!"
              : filter === "por-cobrar"
                ? summary.activeMembers === 0
                  ? `Todavía no inscribiste a nadie. Entrá a la ficha de un ${words.one} y tocá “Inscribir en un plan”.`
                  : "No hay cuotas por cobrar en los próximos días."
                : "No hay cuotas para mostrar."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {result.rows.map((charge) => {
            const open = charge.derived === "pendiente" || charge.derived === "parcial" || charge.derived === "vencida";
            return (
              <li key={charge.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 shadow-soft sm:flex-nowrap">
                {/* Phones: name on the first line, amount and actions on the second. */}
                <Link href={`/dashboard/cuotas/${charge.id}`} className="flex min-w-0 flex-1 basis-full items-center gap-3 hover:text-primary sm:basis-0">
                  <EntityAvatar name={charge.clientName} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-bold">{charge.clientName}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {charge.planName} · vence {formatCalendarDate(charge.dueDate, "dd/MM/yyyy")}
                    </span>
                  </span>
                </Link>
                <span className="flex flex-col leading-tight sm:items-end">
                  <span className="font-extrabold tabular">{money(charge.amount)}</span>
                  {charge.amountPaid > 0 && charge.derived !== "pagada" && (
                    <span className="text-xs text-muted-foreground tabular">pagó {money(charge.amountPaid)}</span>
                  )}
                </span>
                <ChargeBadge status={charge.derived} />
                <div className="ml-auto flex items-center gap-2 sm:ml-0">
                  {open && canPay && (
                    <PaymentDialog
                      chargeId={charge.id}
                      clientName={charge.clientName}
                      description={`${charge.planName} · vence ${formatCalendarDate(charge.dueDate, "dd/MM/yyyy")}`}
                      remainingInput={formatAmountInput(charge.remaining, charge.currency)}
                      remainingLabel={money(charge.remaining)}
                      currencyPrefix={prefix}
                      today={today}
                    />
                  )}
                  {open && <ReminderLink charge={charge} template={ctx.settings.paymentReminderTemplate} />}
                  <Link href={`/dashboard/cuotas/${charge.id}`} aria-label={`Ver cuota de ${charge.clientName}`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
                    <ChevronRightIcon />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={result.page} pageCount={result.pageCount} hrefForPage={(p) => hrefFor({ page: p })} />
    </>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "success" | "info" | "coral" | "neutral";
}) {
  const tones = {
    success: "bg-success-soft text-success-foreground",
    info: "bg-primary-soft text-primary-soft-foreground",
    coral: "bg-coral-soft text-coral-foreground",
    neutral: "bg-muted text-muted-foreground",
  };
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft">
      <span className={cn("flex size-9 items-center justify-center rounded-xl", tones[tone])}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="text-xl font-extrabold tabular sm:text-2xl">{value}</span>
      <span className="text-sm text-muted-foreground first-letter:uppercase">{label}</span>
    </div>
  );
}
