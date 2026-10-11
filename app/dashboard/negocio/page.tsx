import { CheckCircle2Icon, ChevronRightIcon, CircleAlertIcon, CircleDashedIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { NavIcon } from "@/components/dashboard/nav-icon";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { PageHeader } from "@/components/ui-kit/page-header";
import { vocabularyFor } from "@/lib/business-types";
import { getWeeklySchedule } from "@/lib/data/availability";
import { findServiceProblems } from "@/lib/data/services";
import { getSetupStatus } from "@/lib/data/setup";
import { listStaff } from "@/lib/data/staff";
import { SECTION_HREFS, sectionHelp, type Section } from "@/lib/help-content";
import { setupSections } from "@/lib/navigation";
import { describeSchedule } from "@/lib/schedule-wizard";
import { getTenantContextOrRedirect } from "@/lib/tenant";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mi negocio" };

type Status = { tone: "done" | "todo" | "fix"; text: string };

export default function BusinessPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={5} />}>
      <Business />
    </Suspense>
  );
}

async function Business() {
  const ctx = await getTenantContextOrRedirect();
  const { settings } = ctx;
  const words = vocabularyFor(settings.businessType);
  const [status, problems, people] = await Promise.all([
    getSetupStatus(ctx),
    settings.appointmentsEnabled ? findServiceProblems(ctx) : Promise.resolve(new Map<string, string>()),
    settings.appointmentsEnabled ? listStaff(ctx) : Promise.resolve([]),
  ]);
  const solo = settings.teamMode === "solo";
  const soloRules = solo && people[0] ? await getWeeklySchedule(ctx, people[0].id) : [];

  const statusFor: Record<Section, () => Status> = {
    schedule: () => {
      if (status.availabilityRules === 0) return { tone: "todo", text: "Falta configurar: todavía nadie puede reservar." };
      if (solo) {
        const days = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
          weekday,
          ranges: soloRules.filter((rule) => rule.weekday === weekday).map((rule) => ({ start: rule.startTime, end: rule.endTime })),
        }));
        return { tone: "done", text: describeSchedule(days) };
      }
      return { tone: "done", text: "Cada persona tiene su horario." };
    },
    services: () => {
      if (problems.size > 0) return { tone: "fix", text: `${problems.size} ${problems.size === 1 ? `${words.service.one} necesita` : `${words.service.many} necesitan`} arreglo.` };
      if (status.services === 0) return { tone: "todo", text: `Falta configurar: cargá tu primer ${words.service.one}.` };
      return { tone: "done", text: `${status.services} ${status.services === 1 ? words.service.one : words.service.many}.` };
    },
    team: () =>
      status.staff > 1
        ? { tone: "done", text: `${status.staff} ${words.staff.many}.` }
        : { tone: "todo", text: `Sumá a tu equipo: por ahora solo estás vos.` },
    plans: () =>
      status.plans > 0
        ? { tone: "done", text: `${status.plans} ${status.plans === 1 ? "plan" : "planes"}.` }
        : { tone: "todo", text: "Falta configurar: creá tu primer plan." },
    settings: () => ({ tone: "done", text: "Datos del negocio, reservas online, cuotas y recordatorios." }),
    home: () => ({ tone: "done", text: "" }),
    agenda: () => ({ tone: "done", text: "" }),
    cuotas: () => ({ tone: "done", text: "" }),
    reminders: () => ({ tone: "done", text: "" }),
    clients: () => ({ tone: "done", text: "" }),
    business: () => ({ tone: "done", text: "" }),
  };

  return (
    <>
      <PageHeader title="Mi negocio" description="Lo que se configura una vez. Entrá solo a lo que necesites cambiar." />
      <ul className="grid gap-3 sm:grid-cols-2">
        {setupSections(settings).map((section) => {
          const help = sectionHelp(section, settings);
          const current = statusFor[section]();
          const Icon = current.tone === "done" ? CheckCircle2Icon : current.tone === "fix" ? CircleAlertIcon : CircleDashedIcon;
          return (
            <li key={section} className={cn(section === "settings" && "sm:col-span-2")}>
              <Link
                href={SECTION_HREFS[section]}
                className={cn(
                  "flex h-full items-start gap-4 rounded-3xl border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift",
                  current.tone === "fix" && "border-coral/50",
                )}
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <NavIcon name={section} className="size-6" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-lg font-bold">{help.title}</span>
                  <span className="text-sm text-muted-foreground">{help.what}</span>
                  <span
                    className={cn(
                      "mt-1 flex items-start gap-1.5 text-sm font-semibold",
                      current.tone === "done" ? "text-success-foreground" : current.tone === "fix" ? "text-coral-foreground" : "text-warning-foreground",
                    )}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {current.text}
                  </span>
                </span>
                <ChevronRightIcon className="mt-3 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
