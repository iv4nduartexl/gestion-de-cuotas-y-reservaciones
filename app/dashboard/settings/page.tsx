import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { ActivityList } from "@/components/settings/activity-list";
import { BusinessProfileForm } from "@/components/settings/business-profile-form";
import { BookingRulesForm } from "@/components/settings/booking-rules-form";
import { BusinessUsageForm } from "@/components/settings/business-usage-form";
import { MembershipSettingsForm } from "@/components/settings/membership-settings-form";
import { ReminderSettingsForm } from "@/components/settings/reminder-settings-form";
import { PublicProfileForm } from "@/components/settings/public-profile-form";
import { TeamModeForm } from "@/components/settings/team-mode-form";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SummaryCard } from "@/components/wizard/summary-card";
import { SectionCard } from "@/components/ui-kit/section-card";
import { listAuditEvents } from "@/lib/audit";
import { BUSINESS_TYPE_INFO } from "@/lib/business-types";
import { listServices } from "@/lib/data/services";
import { productUsage } from "@/lib/data/settings";
import { unitAmount } from "@/lib/membership-constants";
import { env } from "@/lib/env";
import { formatPhone } from "@/lib/phone";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";
import { listTimeZones, timeZoneLabel } from "@/lib/timezones";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Configuración" };

type Tab = "negocio" | "reservas" | "cuotas" | "recordatorios" | "actividad";

export default function SettingsPage({ searchParams }: PageProps<"/dashboard/settings">) {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <Settings searchParams={searchParams} />
    </Suspense>
  );
}

function Summary({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{children}</span>;
}

function days(n: number) {
  return `${n} día${n === 1 ? "" : "s"}`;
}

async function Settings({ searchParams }: { searchParams: PageProps<"/dashboard/settings">["searchParams"] }) {
  const ctx = await getTenantContextOrRedirect();
  const { settings, organization } = ctx;
  const editable = can(ctx, { businessSettings: ["update"] });
  const appHost = new URL(env.BETTER_AUTH_URL).host;
  const params = await searchParams;
  const durations = settings.appointmentsEnabled ? (await listServices(ctx)).flatMap((service) => (service.durationMinutes ? [service.durationMinutes] : [])) : [];
  const shortestService = durations.length > 0 ? Math.min(...durations) : null;

  const tabs: { value: Tab; label: string; description: string }[] = [
    { value: "negocio", label: "Tu negocio", description: "Nombre, link, qué partes de Agenda usás y forma de trabajo." },
    ...(settings.appointmentsEnabled
      ? [{ value: "reservas" as const, label: "Reservas online", description: "Cómo reservan tus clientes desde tu link y qué ven en tu página." }]
      : []),
    ...(settings.membershipsEnabled
      ? [{ value: "cuotas" as const, label: "Cuotas", description: "Cuándo una cuota pasa a vencida y qué mensaje se manda." }]
      : []),
    { value: "recordatorios", label: "Recordatorios", description: "Cuándo Agenda le recuerda a tus clientes sus turnos y cuotas." },
    ...(editable
      ? [{ value: "actividad" as const, label: "Actividad", description: "Quién hizo qué: pagos deshechos, cuotas anuladas, cambios de configuración y del equipo." }]
      : []),
  ];
  const tab = tabs.find((t) => t.value === params.seccion) ?? tabs[0];
  // One thing at a time: a summary with "Cambiar", which opens only that form.
  const editing = editable && typeof params.editar === "string" ? params.editar : null;
  const show = (key: string) => !editable || editing === key;
  const edit = (key: string) => `/dashboard/settings?${tab.value === "negocio" ? "" : `seccion=${tab.value}&`}editar=${key}`;
  const tabHref = tab.value === "negocio" ? "/dashboard/settings" : `/dashboard/settings?seccion=${tab.value}`;
  const products = [settings.appointmentsEnabled && "Turnos", settings.membershipsEnabled && "Cuotas"].filter(Boolean).join(" + ");
  const turnoReminders = [settings.remindAppointments24h && "el día anterior", settings.remindAppointments2h && "2 h antes"].filter(Boolean).join(" y ");
  const reminderSummary: [string, string][] = [
    ...(settings.appointmentsEnabled ? [["Turnos", turnoReminders || "sin aviso"] as [string, string]] : []),
    ...(settings.membershipsEnabled
      ? [["Cuotas", settings.remindChargesDaysBefore > 0 ? `${days(settings.remindChargesDaysBefore)} antes` : "sin aviso previo"] as [string, string]]
      : []),
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/negocio", label: "Mi negocio" }}
        help={{ section: "settings", settings: ctx.settings, open: false }}
        title="Configuración"
        description="Los datos de tu negocio y cómo usás Agenda."
      />

      <div className="flex flex-col gap-2">
        <nav className="-mx-1 flex gap-2 overflow-x-auto px-1" aria-label="Secciones de configuración">
          {tabs.map((t) => (
            <Link
              key={t.value}
              href={t.value === "negocio" ? "/dashboard/settings" : `/dashboard/settings?seccion=${t.value}`}
              aria-current={t.value === tab.value ? "page" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors",
                t.value === tab.value ? "bg-primary text-primary-foreground" : "border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-muted-foreground">{tab.description}</p>
      </div>

      {editing && (
        <Link href={tabHref} className="w-fit text-sm font-semibold text-primary">
          ← Volver al resumen
        </Link>
      )}

      {editable && !editing && tab.value === "negocio" && (
        <SummaryCard
          rows={[
            { label: "Nombre", value: organization.name, href: edit("perfil") },
            { label: "Link de reservas", value: `${appHost}/${settings.slug}`, href: edit("perfil") },
            { label: "Zona horaria", value: timeZoneLabel(settings.timezone), href: edit("perfil") },
            { label: "Qué usás", value: `${BUSINESS_TYPE_INFO[settings.businessType].label} · ${products}`, href: edit("uso") },
            ...(settings.appointmentsEnabled
              ? [{ label: "Forma de trabajo", value: settings.teamMode === "team" ? "Con equipo" : "Solo/a", href: edit("equipo") }]
              : []),
            { label: "Moneda", value: settings.currency === "PYG" ? "Guaraníes (Gs.)" : settings.currency },
          ]}
        />
      )}
      {editable && !editing && tab.value === "reservas" && (
        <SummaryCard
          rows={[
            { label: "Confirmación", value: settings.autoConfirmBookings ? "Automática" : "La confirmás vos", href: edit("reglas") },
            { label: "Se puede reservar", value: `Hasta ${days(settings.maxDaysAhead)} antes`, href: edit("reglas") },
            { label: "Cancelación online", value: settings.clientCancelNoticeHours === 0 ? "Hasta la hora del turno" : `Hasta ${settings.clientCancelNoticeHours} h antes`, href: edit("reglas") },
            { label: "WhatsApp y dirección", value: [settings.publicPhone ? formatPhone(settings.publicPhone) : null, settings.address].filter(Boolean).join(" · ") || "Sin cargar", href: edit("publico") },
          ]}
        />
      )}
      {editable && !editing && tab.value === "cuotas" && (
        <SummaryCard
          rows={[
            { label: "Tolerancia", value: settings.graceCount === 0 ? "Sin tolerancia" : unitAmount(settings.graceUnit, settings.graceCount), href: edit("cuotas") },
            { label: "Mensaje de cuota vencida", value: settings.paymentReminderTemplate ? "Personalizado" : "El de Agenda", href: edit("cuotas") },
          ]}
        />
      )}
      {editable && !editing && tab.value === "recordatorios" && (
        <SummaryCard rows={reminderSummary.map(([label, value]) => ({ label, value, href: edit("recordatorios") }))} />
      )}

      {tab.value === "negocio" && (
        <>
          <>{show("perfil") && (<SectionCard
            title="Datos del negocio"
            description="Lo que ven tus clientes: el nombre y tu link de reservas."
            actions={<Summary>{`${appHost}/${settings.slug}`}</Summary>}
          >
            {editable ? (
              <BusinessProfileForm
                name={organization.name}
                slug={settings.slug}
                timezone={settings.timezone}
                timezones={listTimeZones()}
                appHost={appHost}
              />
            ) : (
              <ReadOnly
                rows={[
                  ["Nombre", organization.name],
                  ["Link", `${appHost}/${settings.slug}`],
                  ["Zona horaria", timeZoneLabel(settings.timezone)],
                ]}
              />
            )}
          </SectionCard>)}</>

          <>{show("uso") && (<SectionCard
            title="Qué usás"
            description="Prendé o apagá las partes de Agenda que necesitás. No se borra nada."
            actions={<Summary>{products}</Summary>}
          >
            {editable ? (
              <BusinessUsageForm
                businessType={settings.businessType}
                appointmentsEnabled={settings.appointmentsEnabled}
                membershipsEnabled={settings.membershipsEnabled}
                usage={await productUsage(ctx)}
              />
            ) : (
              <ReadOnly
                rows={[
                  ["Tipo de negocio", BUSINESS_TYPE_INFO[settings.businessType].label],
                  ["Turnos online", settings.appointmentsEnabled ? "Sí" : "No"],
                  ["Cuotas y membresías", settings.membershipsEnabled ? "Sí" : "No"],
                ]}
              />
            )}
          </SectionCard>)}</>

          {settings.appointmentsEnabled && (
            <>{show("equipo") && (<SectionCard
              title="Forma de trabajo"
              description="¿Atendés vos solo/a o tenés un equipo? Con equipo, cada persona tiene su propio horario."
              actions={<Summary>{settings.teamMode === "team" ? "Equipo" : "Solo/a"}</Summary>}
            >
              {editable ? (
                <TeamModeForm teamMode={settings.teamMode} />
              ) : (
                <ReadOnly rows={[["Forma de trabajo", settings.teamMode === "team" ? "Equipo" : "Solo/a"]]} />
              )}
            </SectionCard>)}</>
          )}

          <>{show("moneda") && (<SectionCard title="Moneda" description="Todos los precios se guardan en esta moneda.">
            <ReadOnly rows={[["Moneda", settings.currency === "PYG" ? "Guaraníes (Gs.)" : settings.currency]]} />
          </SectionCard>)}</>
        </>
      )}

      {tab.value === "reservas" && (
        <>
          <>{show("reglas") && (<SectionCard
            title="Reglas de reserva"
            description="Cómo reservan tus clientes desde tu link: anticipación, horarios ofrecidos y cancelaciones."
            actions={
              <Summary>
                {settings.autoConfirmBookings ? "Confirmación automática" : "Confirmás vos"} · hasta {days(settings.maxDaysAhead)} antes
              </Summary>
            }
          >
            {editable ? (
              <BookingRulesForm rules={settings} shortestServiceMinutes={shortestService} />
            ) : (
              <ReadOnly rows={[["Confirmación", settings.autoConfirmBookings ? "Automática" : "Manual"]]} />
            )}
          </SectionCard>)}</>

          <>{show("publico") && (<SectionCard title="Datos públicos" description="Se muestran en tu página de reservas.">
            {editable ? (
              <PublicProfileForm
                publicPhone={settings.publicPhone ? formatPhone(settings.publicPhone) : null}
                address={settings.address}
                description={settings.description}
              />
            ) : (
              <ReadOnly
                rows={[
                  ["WhatsApp", settings.publicPhone ? formatPhone(settings.publicPhone) : "—"],
                  ["Dirección", settings.address ?? "—"],
                ]}
              />
            )}
          </SectionCard>)}</>
        </>
      )}

      {tab.value === "cuotas" && (
        <>{show("cuotas") && (<SectionCard
          title="Cuotas"
          description="Cuándo una cuota pasa a vencida y qué mensaje se manda para recordarla."
          actions={<Summary>{settings.graceCount === 0 ? "Sin tolerancia" : `${unitAmount(settings.graceUnit, settings.graceCount)} de tolerancia`}</Summary>}
        >
          {editable ? (
            <MembershipSettingsForm graceCount={settings.graceCount} graceUnit={settings.graceUnit} template={settings.paymentReminderTemplate} />
          ) : (
            <ReadOnly rows={[["Tolerancia", settings.graceCount === 0 ? "Sin tolerancia" : unitAmount(settings.graceUnit, settings.graceCount)]]} />
          )}
        </SectionCard>)}</>
      )}

      {tab.value === "actividad" && (
        <SectionCard title="Actividad" description="Los últimos 200 cambios importantes. No se pueden editar ni borrar.">
          <ActivityList events={await listAuditEvents(ctx)} timeZone={settings.timezone} currency={settings.currency} />
        </SectionCard>
      )}

      {tab.value === "recordatorios" && (
        <>{show("recordatorios") && (<SectionCard
          title="Recordatorios"
          description="Cuándo Agenda le recuerda a tus clientes sus turnos y cuotas."
          actions={<Summary>{reminderSummary.map(([label, value]) => `${label}: ${value}`).join(" · ")}</Summary>}
        >
          {editable ? (
            <ReminderSettingsForm
              settings={settings}
              appointments={settings.appointmentsEnabled}
              memberships={settings.membershipsEnabled}
              businessName={organization.name}
            />
          ) : (
            <ReadOnly rows={reminderSummary} />
          )}
        </SectionCard>)}</>
      )}
    </>
  );
}

function ReadOnly({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-[12rem_1fr]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
          <dd className="font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
