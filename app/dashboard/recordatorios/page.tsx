import { MailIcon, MessageCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ListSkeleton } from "@/components/dashboard/list-skeleton";
import { Pagination } from "@/components/dashboard/pagination";
import { ReminderTray } from "@/components/reminders/reminder-tray";
import { Badge } from "@/components/ui/badge";
import { HelpHint } from "@/components/ui-kit/help-hint";
import { PageHeader } from "@/components/ui-kit/page-header";
import { countTrayReminders, listReminderHistory, listTrayReminders, reminderAccessFor } from "@/lib/data/reminders";
import { formatInZone } from "@/lib/datetime";
import { CHANNEL_LABELS, REMINDER_STATUS_LABELS, type ReminderStatus } from "@/lib/reminder-constants";
import { can, getTenantContextOrRedirect } from "@/lib/tenant";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Recordatorios" };

const STATUS_BADGE: Record<ReminderStatus, "info" | "success" | "neutral" | "coral"> = {
  pending: "info",
  sent: "success",
  done_manually: "success",
  skipped: "neutral",
  failed: "coral",
};

export default function RemindersPage({ searchParams }: PageProps<"/dashboard/recordatorios">) {
  return (
    <Suspense fallback={<ListSkeleton rows={5} />}>
      <Reminders searchParams={searchParams} />
    </Suspense>
  );
}

async function Reminders({ searchParams }: { searchParams: PageProps<"/dashboard/recordatorios">["searchParams"] }) {
  const ctx = await getTenantContextOrRedirect();
  const params = await searchParams;
  const view = params.vista === "historial" ? "historial" : "hoy";
  const page = Math.max(1, Number(params.page) || 1);
  const access = await reminderAccessFor(ctx);
  const canSend = can(ctx, { reminder: ["send"] });

  const tabs = [
    { value: "hoy", label: "Para enviar hoy", href: "/dashboard/recordatorios", count: await countTrayReminders(ctx, access) },
    { value: "historial", label: "Historial", href: "/dashboard/recordatorios?vista=historial", count: 0 },
  ];

  return (
    <>
      <PageHeader
        help={{ section: "reminders", settings: ctx.settings, open: false }}
        title="Recordatorios"
        description="Agenda avisa a tus clientes antes de cada turno y de cada cuota. Por correo salen solos; por WhatsApp los mandás vos con un toque."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1" role="group" aria-label="Vista">
          {tabs.map((tab) => (
            <Link
              key={tab.value}
              href={tab.href}
              aria-current={tab.value === view ? "true" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
                tab.value === view ? "bg-primary text-primary-foreground" : "border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={cn("rounded-full px-1.5 text-xs tabular", tab.value === view ? "bg-white/20" : "bg-coral-soft text-coral-foreground")}>
                  {tab.count}
                </span>
              )}
            </Link>
          ))}
        </div>
        <HowItWorks />
      </div>

      {view === "hoy" ? (
        canSend ? (
          <ReminderTray items={(await listTrayReminders(ctx, access)).map(({ id, group, clientId, clientName, reason, detail, whatsappHref }) => ({ id, group, clientId, clientName, reason, detail, whatsappHref }))} />
        ) : (
          <p className="text-sm text-muted-foreground">No tenés permiso para enviar recordatorios.</p>
        )
      ) : (
        <History ctx={ctx} access={access} page={page} />
      )}
    </>
  );
}

async function History({
  ctx,
  access,
  page,
}: {
  ctx: Awaited<ReturnType<typeof getTenantContextOrRedirect>>;
  access: Awaited<ReturnType<typeof reminderAccessFor>>;
  page: number;
}) {
  const history = await listReminderHistory(ctx, access, { page });
  const tz = ctx.settings.timezone;
  if (history.rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
        Todavía no se mandó ningún recordatorio. Aparecen acá a medida que se envían.
      </p>
    );
  }
  return (
    <>
      <ul className="flex flex-col divide-y rounded-2xl border bg-card shadow-soft">
        {history.rows.map((item) => {
          const ChannelIcon = item.channel === "email" ? MailIcon : MessageCircleIcon;
          return (
            <li key={item.id} className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground" title={CHANNEL_LABELS[item.channel]}>
                <ChannelIcon className="size-4" aria-hidden="true" />
                <span className="sr-only">{CHANNEL_LABELS[item.channel]}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-bold">{item.clientName}</span>
                <span className="text-sm text-muted-foreground sm:truncate">
                  {item.reason} · {item.detail}
                </span>
                {item.status === "failed" && item.lastError && <span className="truncate text-xs text-coral-foreground">{item.lastError}</span>}
              </span>
              <span className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                <Badge variant={STATUS_BADGE[item.status]}>
                  {item.status === "sent" ? `${REMINDER_STATUS_LABELS.sent} por ${CHANNEL_LABELS[item.channel].toLowerCase()}` : REMINDER_STATUS_LABELS[item.status]}
                </Badge>
                <span className="text-xs text-muted-foreground tabular">{formatInZone(item.sentAt ?? item.updatedAt, tz, "dd/MM · HH:mm")}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <Pagination page={history.page} pageCount={history.pageCount} hrefForPage={(p) => `/dashboard/recordatorios?vista=historial${p > 1 ? `&page=${p}` : ""}`} />
    </>
  );
}

function HowItWorks() {
  return (
    <span className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
      ¿Cómo funciona?
      <HelpHint label="¿Cómo funcionan los recordatorios?">
      Cada 15 minutos Agenda revisa los turnos de mañana y las cuotas por vencer. Si el cliente tiene correo, se lo manda solo. Si no, aparece
      acá para que lo mandes por WhatsApp: tocás “Enviar”, se abre WhatsApp con el mensaje escrito y solo tenés que darle a enviar. Los horarios y
      el mensaje se cambian en Configuración → Recordatorios.
      </HelpHint>
    </span>
  );
}
