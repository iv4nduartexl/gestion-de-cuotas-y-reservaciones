import { HistoryIcon } from "lucide-react";

import { AUDIT_ACTIONS, type AuditAction } from "@/lib/audit-constants";
import { formatInZone } from "@/lib/datetime";
import { PAYMENT_METHOD_LABELS } from "@/lib/membership-constants";
import { formatMoney } from "@/lib/money";

type Event = {
  id: string;
  action: string;
  actorName: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
};

/** One readable line of extra context per event, when there is any. */
function describe(event: Event, currency: string): string | null {
  const d = event.details ?? {};
  switch (event.action) {
    case "payment.recorded":
    case "payment.deleted": {
      const method = PAYMENT_METHOD_LABELS[d.method as keyof typeof PAYMENT_METHOD_LABELS]?.split(" (")[0];
      return [typeof d.amount === "number" ? formatMoney(d.amount, (d.currency as string) ?? currency) : null, method].filter(Boolean).join(" · ");
    }
    case "settings.slug":
      return `${d.from} → ${d.to}`;
    case "settings.usage":
      return [d.appointments && "Turnos", d.memberships && "Cuotas"].filter(Boolean).join(" + ") || null;
    case "settings.team_mode":
      return d.to === "team" ? "Equipo" : "Solo/a";
    case "member.invited":
    case "member.invitation_cancelled":
    case "member.removed":
    case "member.role_changed":
      return [d.email, d.role].filter(Boolean).join(" · ") || null;
    case "data.exported":
      return typeof d.kind === "string" ? d.kind : null;
    default:
      return null;
  }
}

export function ActivityList({ events, timeZone, currency }: { events: Event[]; timeZone: string; currency: string }) {
  if (events.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <HistoryIcon className="size-4" aria-hidden="true" /> Todavía no hay actividad registrada.
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y">
      {events.map((event) => {
        const detail = describe(event, currency);
        return (
          <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
            <span className="flex min-w-0 flex-col">
              <span className="text-sm">
                <strong>{event.actorName ?? "Sistema"}</strong> {(AUDIT_ACTIONS[event.action as AuditAction] ?? event.action).toLowerCase()}
              </span>
              {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
            </span>
            <time className="text-xs text-muted-foreground tabular" dateTime={event.createdAt.toISOString()}>
              {formatInZone(event.createdAt, timeZone, "dd/MM/yyyy · HH:mm")}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
