import type { Metadata } from "next";
import { Suspense } from "react";

import { BookingLinkCard } from "@/components/home/booking-link-card";
import { CollectionsCard } from "@/components/home/collections-card";
import { DailyCard, type DailyTask } from "@/components/home/daily-card";
import { RemindersCard } from "@/components/home/reminders-card";
import { SetupGuide, type SetupStep } from "@/components/home/setup-guide";
import { TodayCard } from "@/components/home/today-card";
import { WelcomeTour } from "@/components/home/welcome-tour";
import {
  BookingPhonePreview,
  ClientPreview,
  CuotasPreview,
  TeamPreview,
  TurnoPreview,
  WeekPreview,
  WhatsAppPreview,
} from "@/components/illustrations/previews";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeIn } from "@/components/ui-kit/fade-in";
import { vocabularyFor } from "@/lib/business-types";
import { countPendingAppointments, listUpcomingAppointments } from "@/lib/data/appointments";
import { overdueSummary, syncCharges } from "@/lib/data/charges";
import { getPublicCatalog } from "@/lib/data/public";
import { countTrayReminders, reminderAccessFor } from "@/lib/data/reminders";
import { listServices } from "@/lib/data/services";
import { getSetupStatus } from "@/lib/data/setup";
import { addDaysToDate, formatDuration, todayInZone, zonedToUtc } from "@/lib/datetime";
import { env } from "@/lib/env";
import { exampleServices, planExample } from "@/lib/help-content";
import { whatsappText } from "@/lib/messaging/templates";
import { formatMoney } from "@/lib/money";
import { DEFAULT_APPOINTMENT_TEMPLATE } from "@/lib/reminder-constants";
import { priceSuffix, serviceSummary } from "@/lib/service-format";
import { setupSteps, type StepPreview } from "@/lib/setup-steps";
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
  const tz = settings.timezone;
  const today = todayInZone(tz);
  const [status, params, catalog, services, todayTurnos, pendingCount, overdue, remindersToSend] = await Promise.all([
    getSetupStatus(ctx),
    searchParams,
    settings.appointmentsEnabled ? getPublicCatalog(ctx) : Promise.resolve(null),
    settings.appointmentsEnabled ? listServices(ctx) : Promise.resolve([]),
    settings.appointmentsEnabled
      ? listUpcomingAppointments(ctx, { from: new Date(), to: zonedToUtc(addDaysToDate(today, 1), "00:00", tz), limit: 4 })
      : Promise.resolve([]),
    settings.appointmentsEnabled ? countPendingAppointments(ctx) : Promise.resolve(0),
    settings.membershipsEnabled
      ? syncCharges(ctx, { today }).then(() => overdueSummary(ctx, today))
      : Promise.resolve(null),
    reminderAccessFor(ctx).then((access) => countTrayReminders(ctx, access)),
  ]);
  const words = vocabularyFor(settings.businessType);
  const bookingUrl = `${new URL(env.BETTER_AUTH_URL).origin}/${settings.slug}`;
  const ready = (catalog?.services.length ?? 0) > 0;

  // Real services when there are some, otherwise examples for this business type.
  const previewServices =
    services.length > 0
      ? services.map((service) => ({
          name: service.name,
          meta: `${service.bookingType === "stay" ? serviceSummary(service).split(" · ")[0] : formatDuration(service.durationMinutes ?? 0)} · ${formatMoney(service.price, service.currency)}${priceSuffix(service)}`,
        }))
      : exampleServices(settings.businessType);
  const plan = planExample(settings.businessType);
  const planName = plan.split(" · ")[0];
  const reminderText = whatsappText(
    { kind: "appointment_24h", nombre: "María", servicio: previewServices[0].name, negocio: organization.name, dia: "lunes 12/10", hora: "10:00", link: null, direccion: null },
    { appointment: settings.appointmentReminderTemplate, overdue: null, defaultAppointment: DEFAULT_APPOINTMENT_TEMPLATE },
  );
  const cuotaReminderText = whatsappText(
    { kind: "charge_upcoming", nombre: "María", plan: planName, negocio: organization.name, monto: "Gs. 150.000", vencimiento: "15/10", dias: 3 },
    { appointment: null, overdue: null, defaultAppointment: DEFAULT_APPOINTMENT_TEMPLATE },
  );

  const previews: Record<StepPreview, React.ReactNode> = {
    schedule: <WeekPreview />,
    services: <BookingPhonePreview businessName={organization.name} services={previewServices} caption="Así van a aparecer en tu link" />,
    team: <TeamPreview staffWord={words.staff.one} />,
    plans: <CuotasPreview plan={planName} caption="Con un plan, las cuotas se arman solas" />,
    clients: <ClientPreview />,
    enroll: <WhatsAppPreview text={cuotaReminderText} caption="Y antes de que venza, se lo recordamos" />,
    booking: <TurnoPreview service={previewServices[0].name} />,
  };
  const steps: SetupStep[] = setupSteps(settings, status, bookingUrl).map((step) => ({ ...step, preview: previews[step.id] }));
  const pending = steps.filter((step) => !step.done).length;

  // What still blocks online bookings, in the user's words.
  const missing: string[] = [];
  if (settings.appointmentsEnabled && !ready) {
    if (status.availabilityRules === 0) missing.push("Definir tu horario de atención");
    if (status.services === 0) missing.push(`Cargar tus ${words.service.many}`);
    if (missing.length === 0) missing.push(`Asignar personas con horario a tus ${words.service.many}`);
  }

  const dailyTasks: DailyTask[] = [];
  if (settings.appointmentsEnabled) {
    dailyTasks.push({
      section: "agenda",
      href: "/dashboard/agenda",
      title: "Mirá tu Agenda",
      detail: pendingCount > 0 ? `${pendingCount} turno${pendingCount === 1 ? "" : "s"} por confirmar` : "Confirmá turnos y marcá quién vino.",
      count: pendingCount,
    });
  }
  if (settings.membershipsEnabled) {
    const overdueCount = overdue?.count ?? 0;
    dailyTasks.push({
      section: "cuotas",
      href: overdueCount > 0 ? "/dashboard/cuotas?filtro=vencidas" : "/dashboard/cuotas",
      title: "Anotá los pagos",
      detail:
        overdueCount > 0
          ? `${overdueCount} cuota${overdueCount === 1 ? "" : "s"} vencida${overdueCount === 1 ? "" : "s"} · ${formatMoney(overdue?.amount ?? 0, settings.currency)}`
          : "Cuando alguien te paga, registralo en su cuota.",
      count: overdueCount,
    });
  }
  dailyTasks.push({
    section: "reminders",
    href: "/dashboard/recordatorios",
    title: "Mandá los recordatorios",
    detail: remindersToSend > 0 ? `${remindersToSend} por enviar por WhatsApp` : "Hoy no hay pendientes. Los de correo salen solos.",
    count: remindersToSend,
  });

  return (
    <>
      {params.bienvenida === "1" && (
        <WelcomeTour
          businessName={organization.name}
          appointments={settings.appointmentsEnabled}
          memberships={settings.membershipsEnabled}
          clientWord={words.client.many}
          services={previewServices}
          planExample={plan}
          reminderText={settings.appointmentsEnabled ? reminderText : cuotaReminderText}
          steps={steps.map((step) => step.title)}
        />
      )}

      <FadeIn className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-extrabold sm:text-4xl">¡Hola, {user.name.split(" ")[0]}!</h1>
        <p className="text-[15px] text-muted-foreground">
          {pending === 0
            ? `${organization.name} está listo. Esto es lo de hoy.`
            : `Te ${pending === 1 ? "falta 1 paso" : `faltan ${pending} pasos`} para dejar ${organization.name} listo.`}
        </p>
      </FadeIn>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <FadeIn delay={0.08} className="flex flex-col gap-6">
          {pending === 0 && <DailyCard tasks={dailyTasks} />}
          <SetupGuide steps={steps} />
        </FadeIn>
        <FadeIn delay={0.12} className="flex flex-col gap-6">
          {/* Something to do today goes first (on phones this column is below the guide). */}
          {remindersToSend > 0 && <RemindersCard count={remindersToSend} />}
          {overdue && status.enrollments > 0 && (
            <CollectionsCard count={overdue.count} amount={formatMoney(overdue.amount, settings.currency)} />
          )}
          {settings.appointmentsEnabled && ready && <TodayCard turnos={todayTurnos} timeZone={tz} pending={pendingCount} />}
          {settings.appointmentsEnabled && <BookingLinkCard url={bookingUrl} businessName={organization.name} missing={missing} />}
          {remindersToSend === 0 && status.clients > 0 && <RemindersCard count={0} />}
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
