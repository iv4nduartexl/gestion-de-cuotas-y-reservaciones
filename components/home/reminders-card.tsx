import { BellRingIcon, CheckCircle2Icon, ChevronRightIcon, MessageCircleIcon } from "lucide-react";
import Link from "next/link";

export function RemindersCard({ count }: { count: number }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-soft">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <BellRingIcon className="size-5 text-primary" aria-hidden="true" /> Recordatorios de hoy
      </h2>
      {count > 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-success-soft p-4 text-success-foreground">
          <MessageCircleIcon className="size-6 shrink-0" aria-hidden="true" />
          <span className="flex flex-col">
            <span className="text-lg font-extrabold tabular">{count} por enviar</span>
            <span className="text-sm">Por WhatsApp, con el mensaje ya escrito.</span>
          </span>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-success-foreground">
          <CheckCircle2Icon className="size-5" aria-hidden="true" /> No hay recordatorios pendientes. Los de correo salen solos.
        </p>
      )}
      <Link href={count > 0 ? "/dashboard/recordatorios" : "/dashboard/recordatorios?vista=historial"} className="flex items-center gap-1 text-sm font-semibold text-primary">
        {count > 0 ? "Enviar recordatorios" : "Ver historial"} <ChevronRightIcon className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
