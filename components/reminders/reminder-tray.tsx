"use client";

import { CalendarDaysIcon, CheckCheckIcon, MessageCircleIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { markAllRemindersDoneAction, markReminderDoneAction, undoReminderDoneAction } from "@/app/dashboard/recordatorios/actions";
import { Button } from "@/components/ui/button";
import { EntityAvatar } from "@/components/ui-kit/entity-avatar";

export type TrayItem = {
  id: string;
  group: "turnos" | "cuotas";
  clientId: string;
  clientName: string;
  reason: string;
  detail: string;
  whatsappHref: string;
};

const GROUPS = [
  { key: "turnos", title: "Turnos", icon: CalendarDaysIcon },
  { key: "cuotas", title: "Cuotas", icon: WalletIcon },
] as const;

/**
 * Today's manual WhatsApp reminders. Tapping "Enviar" opens WhatsApp with the
 * text ready and marks the reminder as sent (with undo).
 */
export function ReminderTray({ items }: { items: TrayItem[] }) {
  // Hidden right away; the server refresh then removes them for real.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const visible = items.filter((item) => !hidden.has(item.id));

  function hide(ids: string[], value: boolean) {
    setHidden((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (value) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function markSent(item: TrayItem) {
    hide([item.id], true);
    startTransition(async () => {
      const result = await markReminderDoneAction([item.id]);
      if (!result.ok) {
        hide([item.id], false);
        toast.error("No se pudo marcar el recordatorio.");
        return;
      }
      toast.success(`Recordatorio a ${item.clientName.split(" ")[0]} marcado como enviado`, {
        action: {
          label: "Deshacer",
          onClick: () =>
            startTransition(async () => {
              const undo = await undoReminderDoneAction(item.id);
              if (undo.ok) hide([item.id], false);
            }),
        },
      });
    });
  }

  function markAll() {
    const ids = visible.map((item) => item.id);
    hide(ids, true);
    startTransition(async () => {
      const result = await markAllRemindersDoneAction();
      if (!result.ok) {
        hide(ids, false);
        toast.error("No se pudieron marcar los recordatorios.");
        return;
      }
      toast.success(`${result.count} recordatorio${result.count === 1 ? "" : "s"} marcado${result.count === 1 ? "" : "s"} como enviado${result.count === 1 ? "" : "s"}`);
    });
  }

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-success-soft text-success-foreground">
          <CheckCheckIcon className="size-6" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold">¡Todo al día!</h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          No hay recordatorios para mandar por WhatsApp hoy. Los que van por correo salen solos.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {GROUPS.map(({ key, title, icon: Icon }) => {
        const groupItems = visible.filter((item) => item.group === key);
        if (groupItems.length === 0) return null;
        return (
          <section key={key} className="flex flex-col gap-3" aria-labelledby={`tray-${key}`}>
            <h2 id={`tray-${key}`} className="flex items-center gap-2 text-sm font-bold tracking-wide text-muted-foreground uppercase">
              <Icon className="size-4" aria-hidden="true" /> {title} · {groupItems.length}
            </h2>
            <ul className="flex flex-col gap-2.5">
              {groupItems.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 shadow-soft sm:flex-nowrap">
                  <Link href={`/dashboard/clients/${item.clientId}`} className="flex min-w-0 flex-1 basis-full items-center gap-3 hover:text-primary sm:basis-0">
                    <EntityAvatar name={item.clientName} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-bold">{item.clientName}</span>
                      <span className="text-sm text-muted-foreground sm:truncate">
                        <span className="font-semibold text-foreground/80">{item.reason}</span> · {item.detail}
                      </span>
                    </span>
                  </Link>
                  <a
                    href={item.whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => markSent(item)}
                    aria-label={`Enviar recordatorio a ${item.clientName} por WhatsApp`}
                    className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-success px-4 text-sm font-semibold text-white shadow-soft hover:bg-success/90 dark:text-success-soft sm:w-auto"
                  >
                    <MessageCircleIcon className="size-4" aria-hidden="true" />
                    Enviar por WhatsApp
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {visible.length > 1 && (
        <div>
          <Button variant="outline" onClick={markAll} disabled={pending}>
            <CheckCheckIcon /> Marcar todos como enviados
          </Button>
        </div>
      )}
    </div>
  );
}
