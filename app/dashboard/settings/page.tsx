import type { Metadata } from "next";
import { Suspense } from "react";

import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { BusinessProfileForm } from "@/components/settings/business-profile-form";
import { BusinessUsageForm } from "@/components/settings/business-usage-form";
import { TeamModeForm } from "@/components/settings/team-mode-form";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SectionCard } from "@/components/ui-kit/section-card";
import { BUSINESS_TYPE_INFO } from "@/lib/business-types";
import { env } from "@/lib/env";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";
import { listTimeZones, timeZoneLabel } from "@/lib/timezones";

export const metadata: Metadata = { title: "Configuración" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={6} />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const ctx = await getTenantContextOrRedirect();
  const { settings, organization } = ctx;
  const editable = can(ctx, { businessSettings: ["update"] });
  const appHost = new URL(env.BETTER_AUTH_URL).host;

  return (
    <>
      <PageHeader title="Configuración" description="Los datos de tu negocio y cómo usás Agenda." />

      <SectionCard title="Datos del negocio" description="Lo que ven tus clientes: el nombre y tu link de reservas.">
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
      </SectionCard>

      <SectionCard title="Qué usás" description="Prendé o apagá las partes de Agenda que necesitás. No se borra nada.">
        {editable ? (
          <BusinessUsageForm
            businessType={settings.businessType}
            appointmentsEnabled={settings.appointmentsEnabled}
            membershipsEnabled={settings.membershipsEnabled}
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
      </SectionCard>

      {settings.appointmentsEnabled && (
        <SectionCard
          title="Forma de trabajo"
          description="¿Atendés vos solo/a o tenés un equipo? Con equipo, cada persona tiene su propio horario."
        >
          {editable ? (
            <TeamModeForm teamMode={settings.teamMode} />
          ) : (
            <ReadOnly rows={[["Forma de trabajo", settings.teamMode === "team" ? "Equipo" : "Solo/a"]]} />
          )}
        </SectionCard>
      )}

      <SectionCard title="Moneda" description="Todos los precios se guardan en esta moneda.">
        <ReadOnly rows={[["Moneda", settings.currency === "PYG" ? "Guaraníes (Gs.)" : settings.currency]]} />
      </SectionCard>
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
