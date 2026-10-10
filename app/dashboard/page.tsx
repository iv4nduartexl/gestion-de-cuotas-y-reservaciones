import { BellRingIcon, CalendarDaysIcon, PartyPopperIcon, WalletIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { BookingLinkCard } from "@/components/home/booking-link-card";
import { SetupGuide, type SetupStep } from "@/components/home/setup-guide";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeIn } from "@/components/ui-kit/fade-in";
import { vocabularyFor } from "@/lib/business-types";
import { getSetupStatus } from "@/lib/data/setup";
import { env } from "@/lib/env";
import { getTenantContextOrRedirect } from "@/lib/tenant";

export const metadata: Metadata = { title: "Inicio" };

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardHome searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardHome({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const ctx = await getTenantContextOrRedirect();
  const { user, organization, settings } = ctx;
  const [status, params] = await Promise.all([getSetupStatus(ctx), searchParams]);
  const words = vocabularyFor(settings.businessType);
  const isNew = params.bienvenida === "1";

  const steps: SetupStep[] = [];
  if (settings.appointmentsEnabled) {
    steps.push({
      title: "Definí tu horario de atención",
      why: "Tus clientes solo van a poder reservar dentro de estos horarios. Si cortás al mediodía, agregás dos franjas. Toma un minuto.",
      href: "/dashboard/schedule",
      cta: "Configurar horario",
      done: status.availabilityRules > 0,
    });
    steps.push({
      title: `Cargá tus ${words.service.many}`,
      why: `Cada ${words.service.one} tiene una duración y un precio: así sabemos cuánto tiempo reservar y cuánto cobrar.`,
      href: status.services > 0 ? "/dashboard/services" : "/dashboard/services/new",
      cta: `Agregar ${words.service.one}`,
      done: status.services > 0,
    });
    if (settings.teamMode === "team") {
      steps.push({
        title: "Sumá a tu equipo",
        why: `Agregá a cada ${words.staff.one}: cada persona tiene su propio horario y elige qué ${words.service.many} realiza.`,
        href: "/dashboard/staff/new",
        cta: "Agregar persona",
        done: status.staff > 1,
      });
    }
  }
  steps.push({
    title: `Cargá tus primeros ${words.client.many}`,
    why: `Guardá a las personas que te visitan con su teléfono y C.I. Después vas a poder escribirles por WhatsApp con un toque.`,
    href: "/dashboard/clients/new",
    cta: `Agregar ${words.client.one}`,
    done: status.clients > 0,
  });

  const pending = steps.filter((step) => !step.done).length;
  const bookingUrl = `${new URL(env.BETTER_AUTH_URL).origin}/${settings.slug}`;

  return (
    <>
      <FadeIn className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-extrabold sm:text-4xl">¡Hola, {user.name.split(" ")[0]}!</h1>
        <p className="text-[15px] text-muted-foreground">
          {pending === 0
            ? `${organization.name} está listo.`
            : `Te ${pending === 1 ? "falta 1 paso" : `faltan ${pending} pasos`} para dejar ${organization.name} listo.`}
        </p>
      </FadeIn>

      {isNew && (
        <FadeIn delay={0.05}>
          <div className="flex items-start gap-4 rounded-2xl border border-coral/30 bg-coral-soft p-5">
            <PartyPopperIcon className="mt-0.5 size-6 shrink-0 text-coral-foreground" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <h2 className="font-bold text-coral-foreground">¡Tu negocio está creado!</h2>
              <p className="text-sm leading-relaxed text-foreground/80">
                Abajo tenés una guía corta. Cada paso te dice para qué sirve, así no cargás nada a ciegas.
              </p>
            </div>
          </div>
        </FadeIn>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <FadeIn delay={0.08}>
          <SetupGuide steps={steps} />
        </FadeIn>
        <FadeIn delay={0.12} className="flex flex-col gap-6">
          {settings.appointmentsEnabled && (
            <BookingLinkCard url={bookingUrl} businessName={organization.name} />
          )}
          <section className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">Próximamente</h2>
              <Badge variant="coral">Nuevo</Badge>
            </div>
            <ul className="flex flex-col gap-3 text-sm leading-relaxed">
              {settings.appointmentsEnabled && (
                <li className="flex gap-3">
                  <CalendarDaysIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    <strong>Agenda del día:</strong> todos tus turnos en un vistazo.
                  </span>
                </li>
              )}
              {settings.membershipsEnabled && (
                <li className="flex gap-3">
                  <WalletIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    <strong>Cuotas:</strong> quién pagó, quién debe y cuánto, mes a mes.
                  </span>
                </li>
              )}
              <li className="flex gap-3">
                <BellRingIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <strong>Recordatorios</strong> automáticos por WhatsApp.
                </span>
              </li>
            </ul>
          </section>
        </FadeIn>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    </>
  );
}
