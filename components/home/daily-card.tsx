import { ChevronRightIcon, SunIcon } from "lucide-react";
import Link from "next/link";

import { NavIcon } from "@/components/dashboard/nav-icon";
import type { Section } from "@/lib/help-content";

export type DailyTask = { section: Section; href: string; title: string; detail: string; count: number };

/** Once setup is done: the three things to check every day, with live counts. */
export function DailyCard({ tasks }: { tasks: DailyTask[] }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-soft sm:p-7" aria-labelledby="daily-title">
      <div className="flex flex-col gap-1">
        <h2 id="daily-title" className="flex items-center gap-2 text-xl font-bold">
          <SunIcon className="size-5 text-coral" aria-hidden="true" /> Qué hacer cada día
        </h2>
        <p className="text-sm text-muted-foreground">Tu negocio ya está configurado. Esto es todo lo que tenés que mirar.</p>
      </div>
      <ul className="flex flex-col gap-2">
        {tasks.map((task) => (
          <li key={task.section}>
            <Link href={task.href} className="flex items-center gap-4 rounded-2xl border p-4 hover:border-primary/40 hover:bg-primary-soft/40">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <NavIcon name={task.section} className="size-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-bold">{task.title}</span>
                <span className="text-sm text-muted-foreground">{task.detail}</span>
              </span>
              {task.count > 0 && (
                <span className="rounded-full bg-coral px-2.5 py-0.5 text-sm font-bold text-white tabular">{task.count}</span>
              )}
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
