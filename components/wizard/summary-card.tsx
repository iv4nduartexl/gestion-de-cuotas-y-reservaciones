import { PencilIcon } from "lucide-react";
import Link from "next/link";

/** A setting per line, each with "Cambiar" (opens only that wizard step). */
export function SummaryCard({
  title,
  rows,
}: {
  title?: string;
  rows: { label: string; value: React.ReactNode; href?: string }[];
}) {
  return (
    <section className="flex flex-col rounded-3xl border bg-card shadow-soft" aria-label={title}>
      {title && <h2 className="px-5 pt-5 text-lg font-bold sm:px-6">{title}</h2>}
      <dl className="flex flex-col divide-y">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 sm:px-6">
            <dt className="w-40 shrink-0 text-sm font-semibold text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 flex-1 font-semibold">{row.value}</dd>
            {row.href && (
              <Link
                href={row.href}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary-soft"
                aria-label={`Cambiar ${row.label.toLowerCase()}`}
              >
                <PencilIcon className="size-3.5" aria-hidden="true" /> Cambiar
              </Link>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
