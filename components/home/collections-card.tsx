import { AlertTriangleIcon, CheckCircle2Icon, ChevronRightIcon, WalletIcon } from "lucide-react";
import Link from "next/link";

export function CollectionsCard({ count, amount }: { count: number; amount: string }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-soft">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <WalletIcon className="size-5 text-primary" aria-hidden="true" /> Cobros
      </h2>
      {count > 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-coral-soft p-4 text-coral-foreground">
          <AlertTriangleIcon className="size-6 shrink-0" aria-hidden="true" />
          <span className="flex flex-col">
            <span className="text-lg font-extrabold tabular">{amount}</span>
            <span className="text-sm">
              {count} cuota{count === 1 ? "" : "s"} vencida{count === 1 ? "" : "s"}
            </span>
          </span>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-success-foreground">
          <CheckCircle2Icon className="size-5" aria-hidden="true" /> No hay cuotas vencidas.
        </p>
      )}
      <Link
        href={count > 0 ? "/dashboard/cuotas?filtro=vencidas" : "/dashboard/cuotas"}
        className="flex items-center gap-1 text-sm font-semibold text-primary"
      >
        {count > 0 ? "Ver vencidas y recordar por WhatsApp" : "Ver cuotas"} <ChevronRightIcon className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
