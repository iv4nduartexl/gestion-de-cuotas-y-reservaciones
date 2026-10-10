import { CalendarClockIcon, CalendarOffIcon, SettingsIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AddHolidaysButton } from "@/components/blocked-slots/add-holidays-button";
import { BlockedSlotForm } from "@/components/blocked-slots/blocked-slot-form";
import { BlockedSlotList } from "@/components/blocked-slots/blocked-slot-list";
import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { WeeklyScheduleEditor } from "@/components/staff/weekly-schedule-editor";
import { saveWeeklyScheduleAction } from "@/app/dashboard/schedule/actions";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { EntityAvatar } from "@/components/ui-kit/entity-avatar";
import { HelpHint } from "@/components/ui-kit/help-hint";
import { getSetupStatus } from "@/lib/data/setup";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SectionCard } from "@/components/ui-kit/section-card";
import { requireProduct } from "@/lib/actions";
import { vocabularyFor } from "@/lib/business-types";
import { getWeeklySchedule } from "@/lib/data/availability";
import { listUpcomingBlockedSlots } from "@/lib/data/blocked-slots";
import { getStaffForMember, listStaff } from "@/lib/data/staff";
import { todayInZone } from "@/lib/datetime";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";
import { timeZoneLabel } from "@/lib/timezones";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Horarios" };

export default function SchedulePage({ searchParams }: PageProps<"/dashboard/schedule">) {
  return (
    <Suspense fallback={<ListSkeleton rows={7} />}>
      <Schedule searchParams={searchParams} />
    </Suspense>
  );
}

type Tab = "semana" | "dias-libres";

async function Schedule({ searchParams }: { searchParams: PageProps<"/dashboard/schedule">["searchParams"] }) {
  const ctx = await getTenantContextOrRedirect();
  requireProduct(ctx, "appointments");
  const words = vocabularyFor(ctx.settings.businessType);
  const params = await searchParams;
  const tab: Tab = params.tab === "dias-libres" ? "dias-libres" : "semana";
  const isTeam = ctx.settings.teamMode === "team";
  const isMember = ctx.role === "member";

  const [people, setup] = await Promise.all([listStaff(ctx), getSetupStatus(ctx)]);
  const hasHours = setup.availabilityRules > 0;
  const ownStaff = isMember ? await getStaffForMember(ctx, ctx.memberId) : null;
  const requested = typeof params.persona === "string" ? params.persona : undefined;
  const person =
    people.find((p) => p.id === requested) ??
    (ownStaff ? people.find((p) => p.id === ownStaff.id) : undefined) ??
    people[0];

  const hrefFor = (next: { tab?: Tab; persona?: string }) => {
    const search = new URLSearchParams();
    const nextTab = next.tab ?? tab;
    if (nextTab !== "semana") search.set("tab", nextTab);
    const nextPerson = next.persona ?? person?.id;
    if (isTeam && nextPerson) search.set("persona", nextPerson);
    const query = search.toString();
    return `/dashboard/schedule${query ? `?${query}` : ""}`;
  };

  if (!person) {
    return (
      <>
        <PageHeader title="Horarios" />
        <EmptyState
          icon={CalendarClockIcon}
          title="No hay nadie para tomar turnos"
          description={`Agregá a una persona del equipo para configurar su horario de atención.`}
          action={
            <Link href={isTeam ? "/dashboard/staff/new" : "/dashboard/settings"} className={buttonVariants()}>
              {isTeam ? "Agregar persona" : <><SettingsIcon aria-hidden="true" /> Ir a configuración</>}
            </Link>
          }
        />
      </>
    );
  }

  const canEditSchedule = can(ctx, { availability: ["update"] });
  const isOwnRecord = person.memberId === ctx.memberId;
  const canBlock = can(ctx, { blockedSlot: ["create"] }) && (!isMember || isOwnRecord);
  const today = todayInZone(ctx.settings.timezone);

  return (
    <>
      <PageHeader
        help={{ section: "schedule", settings: ctx.settings, open: !hasHours }}
        title="Horarios"
        description={
          <>
            Cuándo atendés y qué días no. Tus {words.client.many} solo van a poder reservar dentro de este horario.{" "}
            <span className="whitespace-nowrap text-sm">Zona horaria: {timeZoneLabel(ctx.settings.timezone)}.</span>
          </>
        }
      />

      {isTeam && people.length > 1 && (
        <nav aria-label="Elegir persona" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {people.map((p) => {
            const active = p.id === person.id;
            return (
              <Link
                key={p.id}
                href={hrefFor({ persona: p.id })}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border py-1.5 pr-4 pl-1.5 text-sm font-semibold transition-colors",
                  active ? "border-primary bg-primary-soft text-primary-soft-foreground" : "bg-card hover:bg-muted",
                )}
              >
                <EntityAvatar name={p.name} size="sm" />
                {p.name}
              </Link>
            );
          })}
        </nav>
      )}

      <div role="tablist" aria-label="Secciones de horarios" className="flex w-fit gap-1 rounded-2xl bg-muted p-1">
        <TabLink href={hrefFor({ tab: "semana" })} active={tab === "semana"} icon={<CalendarClockIcon />}>
          Horario semanal
        </TabLink>
        <TabLink href={hrefFor({ tab: "dias-libres" })} active={tab === "dias-libres"} icon={<CalendarOffIcon />}>
          Días libres y feriados
        </TabLink>
      </div>

      {tab === "semana" ? (
        <WeeklyTab
          staffId={person.id}
          title={isTeam ? `Horario de ${person.name}` : "Tu horario de atención"}
          disabled={!canEditSchedule}
          ctx={ctx}
        />
      ) : (
        <DaysOffTab
          ctx={ctx}
          personId={person.id}
          personName={person.name}
          isTeam={isTeam}
          isMember={isMember}
          isOwnRecord={isOwnRecord}
          canBlock={canBlock}
          staffOptions={isMember ? [{ id: person.id, name: person.name }] : people.map(({ id, name }) => ({ id, name }))}
          today={today}
        />
      )}
    </>
  );
}

function TabLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={cn(
        "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors [&_svg]:size-4",
        active ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

async function WeeklyTab({
  ctx,
  staffId,
  title,
  disabled,
}: {
  ctx: Awaited<ReturnType<typeof getTenantContextOrRedirect>>;
  staffId: string;
  title: string;
  disabled: boolean;
}) {
  const rules = await getWeeklySchedule(ctx, staffId);
  return (
    <SectionCard
      title={title}
      description="Prendé los días que atendés y elegí los horarios. Si cortás al mediodía, agregá dos franjas."
    >
      <WeeklyScheduleEditor
        key={staffId}
        action={saveWeeklyScheduleAction.bind(null, staffId)}
        rules={rules}
        disabled={disabled}
      />
    </SectionCard>
  );
}

async function DaysOffTab({
  ctx,
  personId,
  personName,
  isTeam,
  isMember,
  isOwnRecord,
  canBlock,
  staffOptions,
  today,
}: {
  ctx: Awaited<ReturnType<typeof getTenantContextOrRedirect>>;
  personId: string;
  personName: string;
  isTeam: boolean;
  isMember: boolean;
  isOwnRecord: boolean;
  canBlock: boolean;
  staffOptions: { id: string; name: string }[];
  today: string;
}) {
  // Solo mode: all blocks belong to the business. Team: this person's + business-wide.
  const slots = await listUpcomingBlockedSlots(ctx, isTeam ? { staffId: personId } : {});
  const canDeleteAny = can(ctx, { blockedSlot: ["delete"] });

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <SectionCard
        title="Próximos días libres"
        description={isTeam ? `Los de ${personName} y los de todo el negocio.` : "Días u horas en los que no se toman turnos."}
        actions={
          !isMember && (
            <div className="flex items-center gap-1">
              <AddHolidaysButton />
              <HelpHint label="feriados">
                Agrega los feriados nacionales de los próximos 12 meses como días libres de todo el negocio. Algunos
                feriados se trasladan por decreto: revisá las fechas.
              </HelpHint>
            </div>
          )
        }
      >
        <BlockedSlotList
          slots={slots}
          timeZone={ctx.settings.timezone}
          showWho={isTeam}
          canDelete={(slot) => (isMember ? slot.staffId !== null && slot.staffId === personId && isOwnRecord : canDeleteAny)}
        />
      </SectionCard>

      {canBlock && (
        <SectionCard title="Agregar día libre" description="Vacaciones, un trámite, un feriado… Nadie va a poder reservar en ese rango.">
          <BlockedSlotForm
            staffOptions={staffOptions}
            allowBusinessWide={!isMember}
            showStaffPicker={isTeam}
            defaultStaffId={isTeam ? personId : ""}
            today={today}
          />
        </SectionCard>
      )}
    </div>
  );
}
